# Ingredient Photo Scan Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users photograph their fridge or pantry and have Claude Vision identify ingredients, which are then merged into their existing ingredient list via a confirmation panel.

**Architecture:** A new `api/scan.js` serverless function receives a base64 JPEG, calls Claude Haiku vision, and returns `{ ingredients: [...] }`. The `index.html` frontend adds a 📷 camera button to the ingredient input row, handles resizing and POSTing the image, and shows a confirmation panel where users tick which items to add.

**Tech Stack:** Vanilla HTML/CSS/JS (single file frontend), Vercel serverless functions (Node.js), Anthropic Claude Haiku vision API, Canvas API (built-in browser, no packages needed).

---

## Context for the implementer

Before touching anything, note these codebase rules:

1. **All onclick JS functions must be on `window.*`** — e.g. `window.toggleScanOptions = function toggleScanOptions() {...}`. This is required because functions are defined inside a `<script>` block, not at global scope. Any function called from an HTML `onclick=""` attribute that is NOT on `window.*` will silently fail.

2. **Security hook blocks `innerHTML`** — there is a pre-tool hook (`security_reminder_hook.py`) that rejects Edit/Write operations whose `old_string` or `new_string` contain the literal text `innerHTML`. All new JS code in this plan deliberately uses DOM API methods (`createElement`, `appendChild`, `createTextNode`) instead. Do not refactor this to use innerHTML — it will break the hook.

3. **`window.quickAdd(name, qty)` is case-sensitive** — it checks `ingredients.find(i => i.name === name)` with strict equality. Claude Vision returns mixed-case names like `"Chicken"` or `"EGGS"`. Always call `window.quickAdd(name.toLowerCase(), qty)` to avoid creating duplicates alongside existing lowercase entries.

4. **Canvas `toDataURL` returns a data URI, not raw base64** — `canvas.toDataURL('image/jpeg')` returns `"data:image/jpeg;base64,<actual_data>"`. The Claude API requires only the raw base64 part. Strip the prefix with `.split(',')[1]`.

5. **`vercel dev` must be running** to test locally. Start it with `vercel dev --listen 3000` from the project root. The app is then at `http://localhost:3000`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `api/scan.js` | **Create** | Vercel serverless function: validates payload, calls Claude Haiku vision, returns `{ ingredients: [...] }` |
| `index.html` | **Modify** (CSS only) | Add styles for scan button, options dropdown, spinner, confirmation panel, error state |
| `index.html` | **Modify** (HTML only) | Add camera button, two hidden file inputs, scan options div, scan state div, confirmation panel, error div |
| `index.html` | **Modify** (JS only) | Add `toggleScanOptions`, `triggerCamera`, `triggerGallery`, `resizeImage`, `handleScanFile`, `addScannedIngredients`, `dismissScan` |

---

## Chunk 1: `api/scan.js`

### Task 1: Create the serverless function

**Files:**
- Create: `api/scan.js`

- [ ] **Step 1: Verify the `api/` directory exists**

```bash
ls api/
```
Expected output: `meals.js  photo.js  subscribe.js` (photo.js is unused, that's fine)

- [ ] **Step 2: Create `api/scan.js` with the following complete content**

```javascript
// ── In-memory rate limiter (resets on cold start — same pattern as api/meals.js)
const rateLimitMap = new Map();
const RATE_LIMIT = 10;        // max requests
const RATE_WINDOW = 60_000;   // per 60 seconds

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_LENGTH = 4_000_000; // ~3MB of base64 data; guards Vercel's 4.5MB request limit

const SCAN_PROMPT = `Look at this image and identify all visible food ingredients.
For each ingredient, estimate the quantity if visible (e.g. "3 eggs", "500g chicken", "1 onion").
If quantity is not visible, omit it.
Return ONLY valid JSON, no markdown:
{"ingredients":[{"name":"egg","quantity":"3"},{"name":"onion"}]}
If you cannot identify any ingredients, return: {"ingredients":[]}`;

export default async function handler(req, res) {
  // ── CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Rate limiting
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  // ── Validate body
  const body = req.body || {};
  const { image, mimeType } = body;

  if (typeof image !== 'string' || image.length === 0) {
    return res.status(400).json({ error: 'Invalid request: image is required.' });
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return res.status(400).json({ error: 'Invalid request: unsupported image type.' });
  }
  if (image.length > MAX_IMAGE_LENGTH) {
    return res.status(413).json({ error: 'Image too large. Please use a smaller photo.' });
  }

  // ── Call Claude Haiku vision
  // NOTE: Unlike api/meals.js which sends content as a plain string,
  // vision calls require content to be an ARRAY with an image block + text block.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: image }
            },
            { type: 'text', text: SCAN_PROMPT }
          ]
        }]
      })
    });

    clearTimeout(timeout);
    const data = await response.json();

    if (data.content && Array.isArray(data.content)) {
      const rawText = data.content.map(b => b.text || '').join('');
      // Step 1: Extract JSON by finding outermost braces (strips any surrounding prose)
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        let jsonStr = rawText.substring(start, end + 1);
        // Step 2: Clean control characters — same Vercel compilation guard as meals.js
        jsonStr = jsonStr.split('').map(c => {
          const code = c.charCodeAt(0);
          if (code === 9 || code === 10 || code === 13) return ' ';
          if (code < 32 || code === 127) return '';
          return c;
        }).join('');
        try {
          const parsed = JSON.parse(jsonStr);
          return res.status(200).json({ ingredients: parsed.ingredients || [] });
        } catch {
          return res.status(200).json({ ingredients: [] });
        }
      }
    }

    return res.status(200).json({ ingredients: [] });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out. Please try again.' });
    }
    return res.status(500).json({ error: 'Scan failed. Please try manually.' });
  }
}
```

- [ ] **Step 3: Verify the file parses without syntax errors**

```bash
node --check api/scan.js
```
Expected: no output (silence means success). If you see an error, check the line number and fix the syntax.

- [ ] **Step 4: Test the endpoint with curl**

First make sure `vercel dev` is running in another terminal (`vercel dev --listen 3000`). Then:

```bash
# Test: validation rejects missing image field
curl -s -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"mimeType":"image/jpeg"}' | cat
```
Expected: `{"error":"Invalid request: image is required."}`

```bash
# Test: validation rejects bad mimeType
curl -s -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"image":"abc","mimeType":"image/gif"}' | cat
```
Expected: `{"error":"Invalid request: unsupported image type."}`

- [ ] **Step 5: Commit**

```bash
git add api/scan.js
git commit -m "feat: add api/scan.js — Claude Vision serverless endpoint"
```

---

## Chunk 2: `index.html` — CSS

### Task 2: Add scan UI styles

**Files:**
- Modify: `index.html` (CSS section only — insert after the last existing `@keyframes` block)

The new CSS uses only existing design tokens (`--warm-white`, `--shadow-card`, `--terracotta`, `--earth`, `--cream`, `--spring`, `tagPop` keyframe, `ringRotate` keyframe) so no tokens need to be added.

- [ ] **Step 1: Find the insertion point for the CSS**

The CSS block ends around line 370. Find the `.error-state` rule to confirm location:

```bash
grep -n "error-state" index.html | head -5
```

The scan CSS will be inserted immediately after the closing `}` of `.error-state.active`.

- [ ] **Step 2: Insert scan CSS after `.error-state.active { display: block; }` line**

Find this exact text in `index.html`:
```
  .error-state.active { display: block; }
  .error-state p { color: #C43D3D; font-size: 14px; }
```

Add the following block **after** `.error-state p { ... }`:

```css

  /* ── Ingredient photo scan ────────────────────────── */
  .scan-options { display: none; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; padding: 4px 0; }
  .scan-options.visible { display: flex; }
  .scan-option-btn { background: var(--warm-white); border: 1.5px solid var(--terracotta); border-radius: 100px; padding: 8px 16px; font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--terracotta); cursor: pointer; transition: all 0.2s; }
  .scan-option-btn:hover { background: var(--terracotta); color: white; }
  .scan-state { display: none; align-items: center; gap: 10px; padding: 8px 0; color: #8A7560; font-style: italic; font-size: 14px; }
  .scan-state.visible { display: flex; }
  .scan-spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(196,98,45,0.2); border-top-color: var(--terracotta); animation: ringRotate 0.8s linear infinite; flex-shrink: 0; }
  .scan-confirm { display: none; background: var(--warm-white); border: 1.5px solid #E0D8CE; border-radius: 16px; padding: 18px 20px; margin-top: 8px; box-shadow: var(--shadow-card); animation: tagPop 0.3s var(--spring) both; }
  .scan-confirm.visible { display: block; }
  .scan-confirm-title { font-weight: 600; font-size: 14px; color: var(--earth); margin: 0 0 12px; }
  .scan-result-list { list-style: none; padding: 0; margin: 0 0 14px; display: flex; flex-direction: column; gap: 8px; }
  .scan-result-item label { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--earth); cursor: pointer; }
  .scan-result-item input[type="checkbox"] { accent-color: var(--terracotta); width: 16px; height: 16px; cursor: pointer; flex-shrink: 0; }
  .scan-confirm-actions { display: flex; gap: 8px; }
  .scan-add-btn { background: var(--earth); color: var(--cream); border: none; border-radius: 12px; padding: 10px 18px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
  .scan-add-btn:hover { background: var(--terracotta); }
  .scan-cancel-btn { background: transparent; border: 1.5px solid #DDD5C8; border-radius: 12px; padding: 10px 14px; font-family: 'DM Sans', sans-serif; font-size: 14px; color: #8A7560; cursor: pointer; transition: all 0.2s; }
  .scan-cancel-btn:hover { border-color: var(--terracotta); color: var(--terracotta); }
  .scan-error { display: none; background: #FDE8E8; border: 1.5px solid #F5C6C6; border-radius: 12px; padding: 10px 16px; margin-top: 8px; font-size: 13px; color: #C43D3D; }
  .scan-error.visible { display: block; }
```

- [ ] **Step 3: Verify CSS syntax by running the validator**

```bash
node --check index.html 2>&1 | head -5
```
Expected: `SyntaxError` mentioning HTML (that's fine — node can't parse HTML, but this checks the JS blocks). Any CSS brace errors would show up as unexpected characters. The real check is visual in the browser.

- [ ] **Step 4: Spot-check in browser**

Open `http://localhost:3000` and confirm the page still loads with no visual regressions. The new CSS classes are all hidden (`display: none`) so nothing should look different yet.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add scan UI CSS to index.html"
```

---

## Chunk 3: `index.html` — HTML

### Task 3: Add scan HTML elements to the ingredient input card

**Files:**
- Modify: `index.html` (HTML section only — inside `.input-card`)

The current ingredient input row (around line 915) looks like this:
```html
    <div class="ingredient-input-row">
      <input type="text" class="ingredient-input" id="ingredientInput" placeholder='e.g. "rice", "2 eggs", "500g chicken"...' />
      <button class="add-btn" onclick="addIngredient()" title="Add">+</button>
    </div>
```

We need to:
1. Insert a 📷 camera button between the text input and the `+` button
2. Add hidden file inputs directly after the closing `</div>` of the input row
3. Add the scan options, scan state, confirmation panel, and error div after those inputs

- [ ] **Step 1: Add the camera button inside `.ingredient-input-row`**

Find this exact text:
```
      <input type="text" class="ingredient-input" id="ingredientInput" placeholder='e.g. "rice", "2 eggs", "500g chicken"...' />
      <button class="add-btn" onclick="addIngredient()" title="Add">+</button>
```

Replace with:
```
      <input type="text" class="ingredient-input" id="ingredientInput" placeholder='e.g. "rice", "2 eggs", "500g chicken"...' />
      <button class="add-btn" onclick="toggleScanOptions()" title="Scan photo" style="font-size:18px;">📷</button>
      <button class="add-btn" onclick="addIngredient()" title="Add">+</button>
```

- [ ] **Step 2: Add file inputs and scan panels after the `.ingredient-input-row` closing tag**

Find this exact text:
```
    </div>
    <div class="tags-container" id="tagsContainer"></div>
```

Replace with:
```
    </div>
    <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display:none" onchange="handleScanFile(this)">
    <input type="file" id="galleryInput" accept="image/*" style="display:none" onchange="handleScanFile(this)">
    <div id="scanOptions" class="scan-options">
      <button class="scan-option-btn" onclick="triggerCamera()">📷 Take photo</button>
      <button class="scan-option-btn" onclick="triggerGallery()">🖼 Upload from gallery</button>
    </div>
    <div id="scanState" class="scan-state">
      <span class="scan-spinner"></span>
      <span>Scanning your ingredients…</span>
    </div>
    <div id="scanConfirm" class="scan-confirm">
      <p class="scan-confirm-title">Found in your photo</p>
      <ul id="scanResults" class="scan-result-list"></ul>
      <div class="scan-confirm-actions">
        <button id="scanAddBtn" class="scan-add-btn" onclick="addScannedIngredients()">Add 0 ingredients</button>
        <button class="scan-cancel-btn" onclick="dismissScan()">Cancel</button>
      </div>
    </div>
    <div id="scanError" class="scan-error">
      Couldn't identify ingredients — please try manually
    </div>
    <div class="tags-container" id="tagsContainer"></div>
```

- [ ] **Step 3: Verify the page still loads**

```bash
node --check index.html 2>&1 | head -5
```

Open `http://localhost:3000` — the page should load. The 📷 button should now be visible between the text input and the `+` button. Clicking it should do nothing yet (JS not added).

- [ ] **Step 4: Count the new IDs to confirm all 8 are present**

```bash
grep -c "id=\"scanOptions\"\|id=\"scanState\"\|id=\"scanConfirm\"\|id=\"scanError\"\|id=\"scanResults\"\|id=\"scanAddBtn\"\|id=\"cameraInput\"\|id=\"galleryInput\"" index.html
```
Expected: `8`

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add scan HTML elements to ingredient input card"
```

---

## Chunk 4: `index.html` — JavaScript

### Task 4: Add all scan JavaScript functions

**Files:**
- Modify: `index.html` (JS section only — insert before the closing `</script>` tag)

**Important before starting:** All functions that are called from `onclick=""` attributes must be on `window.*`. The functions `toggleScanOptions`, `triggerCamera`, `triggerGallery`, `handleScanFile`, `addScannedIngredients`, and `dismissScan` all have `onclick` callers. The helper `resizeImage` and `showScanError` are internal and do NOT need `window.*`.

**Important:** All DOM building uses `createElement`/`appendChild`/`createTextNode` — no `innerHTML`. This is required to avoid the security hook that blocks edits containing that string.

- [ ] **Step 1: Find the closing `</script>` tag**

```bash
grep -n "</script>" index.html | tail -3
```
Note the line number of the LAST `</script>` tag. The new JS will be inserted immediately before it.

- [ ] **Step 2: Insert the scan JS block**

Find the last `</script>` closing tag. The text immediately before it will be some existing JS function closing brace. Insert the following block **before** `</script>`:

```javascript

  // ── Ingredient photo scan ────────────────────────────────────────────────

  // resizeImage: shrinks the photo to max 800px on its longest side, encodes to JPEG.
  // Returns a Promise of { base64, mimeType }.
  // Uses canvas.toDataURL('image/jpeg').split(',')[1] to get raw base64 —
  // the Claude API needs raw base64 only, not the full data:image/jpeg;base64,... URI.
  function resizeImage(file, maxPx) {
    maxPx = maxPx || 800;
    return new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var w = img.width, h = img.height;
          if (w > maxPx || h > maxPx) {
            if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
            else { w = Math.round(w * maxPx / h); h = maxPx; }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          var dataUri = canvas.toDataURL('image/jpeg');
          resolve({ base64: dataUri.split(',')[1], mimeType: 'image/jpeg' });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // showScanError: shows the error div for 3 seconds then hides it.
  function showScanError() {
    var el = document.getElementById('scanError');
    el.classList.add('visible');
    setTimeout(function() { el.classList.remove('visible'); }, 3000);
  }

  // toggleScanOptions: shows/hides the "Take photo / Upload from gallery" options.
  window.toggleScanOptions = function toggleScanOptions() {
    var opts = document.getElementById('scanOptions');
    if (opts.classList.contains('visible')) {
      dismissScan();
    } else {
      dismissScan();
      opts.classList.add('visible');
    }
  };

  // triggerCamera: programmatically clicks the hidden camera file input.
  window.triggerCamera = function triggerCamera() {
    document.getElementById('cameraInput').click();
  };

  // triggerGallery: programmatically clicks the hidden gallery file input.
  window.triggerGallery = function triggerGallery() {
    document.getElementById('galleryInput').click();
  };

  // handleScanFile: called by both file inputs' onchange.
  // Resizes the image, POSTs to /api/scan, renders the confirmation panel.
  window.handleScanFile = async function handleScanFile(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];

    // Show spinner, hide everything else
    document.getElementById('scanOptions').classList.remove('visible');
    document.getElementById('scanState').classList.add('visible');
    document.getElementById('scanConfirm').classList.remove('visible');
    document.getElementById('scanError').classList.remove('visible');

    try {
      var resized = await resizeImage(file);
      var response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: resized.base64, mimeType: resized.mimeType })
      });
      var data = await response.json();

      document.getElementById('scanState').classList.remove('visible');

      if (!response.ok || data.error) {
        showScanError();
        return;
      }

      var items = data.ingredients || [];
      if (items.length === 0) {
        showScanError();
        return;
      }

      // Build checkbox list using DOM API (no innerHTML — required by codebase security hook)
      var list = document.getElementById('scanResults');
      while (list.firstChild) list.removeChild(list.firstChild);

      items.forEach(function(ing) {
        var li = document.createElement('li');
        li.className = 'scan-result-item';
        var lbl = document.createElement('label');
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.dataset.name = ing.name;
        cb.dataset.quantity = ing.quantity || '';
        var labelText = ing.quantity ? ing.name + ' \u2014 ' + ing.quantity : ing.name;
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(' ' + labelText));
        li.appendChild(lbl);
        list.appendChild(li);
      });

      // Update button label with count
      var btn = document.getElementById('scanAddBtn');
      btn.textContent = 'Add ' + items.length + ' ingredient' + (items.length === 1 ? '' : 's');

      document.getElementById('scanConfirm').classList.add('visible');
    } catch (err) {
      document.getElementById('scanState').classList.remove('visible');
      showScanError();
    }
  };

  // addScannedIngredients: adds all ticked items to the ingredient list.
  // Lowercases names before calling quickAdd because quickAdd does a case-sensitive check.
  window.addScannedIngredients = function addScannedIngredients() {
    var checkboxes = document.querySelectorAll('#scanResults input[type="checkbox"]:checked');
    checkboxes.forEach(function(cb) {
      var name = cb.dataset.name.toLowerCase();
      var qty = cb.dataset.quantity || '';
      window.quickAdd(name, qty);
    });
    dismissScan();
  };

  // dismissScan: hides all scan UI and resets file inputs so the same image can be re-scanned.
  window.dismissScan = function dismissScan() {
    document.getElementById('scanOptions').classList.remove('visible');
    document.getElementById('scanState').classList.remove('visible');
    document.getElementById('scanConfirm').classList.remove('visible');
    document.getElementById('scanError').classList.remove('visible');
    document.getElementById('cameraInput').value = '';
    document.getElementById('galleryInput').value = '';
  };
```

- [ ] **Step 3: Verify JS syntax**

```bash
node --check index.html
```
Expected: a `SyntaxError` pointing at the HTML doctype (that's normal — node can't parse HTML). What you must NOT see is a `SyntaxError` with a line number inside your new JS block. If you do, fix that line.

- [ ] **Step 4: Verify all `window.*` functions are exported**

```bash
grep -n "window\." index.html | grep -E "toggleScanOptions|triggerCamera|triggerGallery|handleScanFile|addScannedIngredients|dismissScan"
```
Expected: 6 lines, one for each function assignment.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add scan JS functions to index.html"
```

---

## Chunk 5: End-to-end verification

### Task 5: Manual test — gallery upload

This tests the full flow: select image → resize → POST → confirmation → add to list.

- [ ] **Step 1: Make sure `vercel dev` is running**

```bash
# In a separate terminal:
vercel dev --listen 3000
```

Open `http://localhost:3000` in a browser.

- [ ] **Step 2: Test the camera button toggle**

Click the 📷 button. Expected: "📷 Take photo" and "🖼 Upload from gallery" options appear below the input row.

Click the 📷 button again. Expected: the options disappear (toggle behaviour).

- [ ] **Step 3: Test gallery upload with a food photo**

Have any food photo on your computer (a phone screenshot works).

1. Click 📷 → click "🖼 Upload from gallery"
2. Select a food photo
3. Expected: options disappear, spinner appears with "Scanning your ingredients…"
4. After a few seconds (Claude Haiku is fast): spinner disappears, "Found in your photo" panel slides in
5. Panel shows a list of ingredients with pre-ticked checkboxes
6. Button reads "Add N ingredients" (N = number found)

- [ ] **Step 4: Test the confirmation panel**

1. Untick one or two items
2. Confirm the button count updates — **wait**: the count does NOT auto-update as you tick/untick in the current spec. The count is set once when the panel opens. That is correct behaviour. The button label shows how many were found initially.
3. Click "Add N ingredients"
4. Expected: ticked items appear as tags in the ingredient list with the `tagPop` animation; the confirmation panel closes

- [ ] **Step 5: Test deduplication**

1. Scan a photo containing "chicken"
2. Note the tag appears as "chicken" (lowercase)
3. Click the 📷 button and scan the same photo again
4. Click "Add" — the chicken tag should NOT appear twice

- [ ] **Step 6: Test Cancel**

1. Scan a photo
2. When confirmation panel appears, click "Cancel"
3. Expected: panel disappears, no ingredients added

- [ ] **Step 7: Test error state**

Test with a non-food image (e.g. a screenshot of a webpage):
1. Scan a non-food photo
2. Expected: either the confirmation panel shows with whatever Claude found, OR the error message "Couldn't identify ingredients — please try manually" appears for 3 seconds

This is acceptable behaviour — Claude may still find some food items in non-food images. The error only triggers when Claude returns an empty array or the API call fails.

- [ ] **Step 8: Final syntax check**

```bash
node --check index.html
node --check api/scan.js
```

Count backtick characters in index.html (must be even):
```bash
grep -o '`' index.html | wc -l
```

Count curly braces in index.html (must be balanced in JS sections):
```bash
grep -c "{" index.html; grep -c "}" index.html
```
These two numbers should match.

- [ ] **Step 9: Final commit**

```bash
git add index.html api/scan.js
git status
git commit -m "feat: ingredient photo scan — complete implementation

Camera/gallery photo scan using Claude Haiku vision.
User photographs fridge/pantry, confirms detected ingredients,
items merge into existing list via quickAdd().

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Progress Tracker

| Chunk | Task | Status |
|-------|------|--------|
| 1 | `api/scan.js` serverless function | ☐ |
| 2 | `index.html` CSS | ☐ |
| 3 | `index.html` HTML | ☐ |
| 4 | `index.html` JS | ☐ |
| 5 | End-to-end verification | ☐ |

---

## Spec reference

Full design spec: `docs/superpowers/specs/2026-03-15-ingredient-scan-design.md`
