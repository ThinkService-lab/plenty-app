# Ingredient Photo Scan — Design Spec

**Date:** 2026-03-15
**Feature:** Camera/photo scan to identify ingredients
**Status:** Approved for implementation

---

## Goal

Allow users to photograph their fridge, pantry, or countertop and have Claude Vision automatically identify ingredients, which are then merged into their existing ingredient list — removing the friction of manual typing.

---

## Architecture

- **New file:** `api/scan.js` — Vercel serverless function, mirrors `api/meals.js` pattern
- **Modified file:** `index.html` — UI additions only (camera button, scan options, confirmation panel, scan state CSS)
- **No new secrets:** Uses the existing `ANTHROPIC_API_KEY` environment variable
- **No new dependencies:** Canvas API (built into browser) for image resizing; no new npm packages

---

## Data Flow

1. User clicks the 📷 camera icon button in the ingredient input row
2. Two options appear inline below the row: **"📷 Take photo"** and **"🖼 Upload from gallery"**
3. User selects an image via the appropriate hidden `<input type="file">`
   - Camera input uses `capture="environment"` (rear camera on mobile)
   - Gallery input has no capture attribute (file picker on desktop, gallery on mobile)
4. Frontend resizes the image to max 800px on either dimension using the Canvas API, then converts to base64
5. Frontend POSTs `{ image: "<base64>", mimeType: "image/jpeg" }` to `/api/scan`
6. `api/scan.js` validates payload, checks rate limit, then calls Claude Haiku vision
7. Claude returns JSON: `{"ingredients": [{"name": "chicken", "quantity": "500g"}, ...]}`
8. Frontend renders the confirmation panel with pre-ticked checkboxes
9. User reviews, unticks unwanted items, clicks **"Add [n] ingredients"**
10. Ticked ingredients merge into the existing tag list via `window.quickAdd()` (duplicates skipped automatically), each with `tagPop` animation
11. Camera options and confirmation panel dismiss

---

## UI Changes — `index.html`

### Camera button placement
A 📷 icon button inserted between the ingredient text input and the existing `+` button in `.ingredient-input-row`. Styled to match the existing `+` add button (same height, same border-radius, terracotta background).

### Two hidden file inputs
Both include `onchange="handleScanFile(this)"`:
```html
<input type="file" id="cameraInput" accept="image/*" capture="environment" style="display:none" onchange="handleScanFile(this)">
<input type="file" id="galleryInput" accept="image/*" style="display:none" onchange="handleScanFile(this)">
```

### Scan options (inline, below input row)
Shown when camera button is clicked, hidden otherwise:
```html
<div id="scanOptions" class="scan-options" style="display:none">
  <button onclick="triggerCamera()">📷 Take photo</button>
  <button onclick="triggerGallery()">🖼 Upload from gallery</button>
</div>
```

### Scan state indicator
Replaces scan options while waiting for API response:
```html
<div id="scanState" class="scan-state" style="display:none">
  <span class="scan-spinner"></span>
  <span>Scanning your ingredients…</span>
</div>
```

### Confirmation panel
Slides in below the input row after scan completes:
```html
<div id="scanConfirm" class="scan-confirm" style="display:none">
  <p class="scan-confirm-title">Found in your photo</p>
  <div id="scanResults"></div>
  <div class="scan-confirm-actions">
    <button id="scanAddBtn" onclick="addScannedIngredients()">Add ingredients</button>
    <button onclick="dismissScan()">Cancel</button>
  </div>
</div>
```

### Error state
Inline error below the input row, auto-dismisses after 3 seconds:
```html
<div id="scanError" class="scan-error" style="display:none">
  Couldn't identify ingredients — please try manually
</div>
```

---

## New Serverless Function — `api/scan.js`

### Request
```json
POST /api/scan
{ "image": "<base64 encoded image>", "mimeType": "image/jpeg" }
```

### Security & Validation
Apply the same patterns as `api/meals.js`:
1. **Rate limiting** — reuse the same `isRateLimited(ip)` pattern (10 requests per 60 seconds per IP)
2. **Input validation** — before passing to Claude:
   - `req.body.image` must be a non-empty string
   - `req.body.mimeType` must be one of `["image/jpeg", "image/png", "image/webp"]`
   - `req.body.image.length` must be under 4,000,000 characters (guards against Vercel's 4.5MB request body limit); return HTTP 413 if exceeded

### Claude Vision call
- Model: `claude-haiku-4-5-20251001` (same as meals — within Vercel 10s timeout; confirmed to support vision content blocks)
- Message type: user message with image content block (`{ type: "image", source: { type: "base64", media_type, data } }`) followed by text prompt
- Prompt:
  ```
  Look at this image and identify all visible food ingredients.
  For each ingredient, estimate the quantity if visible (e.g. "3 eggs", "500g chicken", "1 onion").
  If quantity is not visible, omit it.
  Return ONLY valid JSON, no markdown:
  {"ingredients":[{"name":"egg","quantity":"3"},{"name":"onion"}]}
  If you cannot identify any ingredients, return: {"ingredients":[]}
  ```
- `max_tokens: 500` (20+ ingredient dense fridge shots need headroom beyond 300)

### Response parsing
- Apply the same `charCodeAt`-based control character cleaning used in `api/meals.js` before calling `JSON.parse()` — same Vercel compilation risk applies here
- Return parsed JSON directly to frontend

### Response
```json
{ "ingredients": [{"name": "chicken", "quantity": "500g"}, {"name": "tomato", "quantity": "2"}] }
```

### Error handling
- Rate limited: HTTP 429
- Invalid payload: HTTP 400
- Payload too large: HTTP 413
- If Claude returns no ingredients: `{ "ingredients": [] }` — frontend treats as silent fallback
- If API call fails: HTTP 500 with `{ "error": "Scan failed" }` — frontend shows error message

---

## Frontend JS — `index.html`

All new functions assigned to `window.*` per codebase rules:

### `window.toggleScanOptions()`
Shows/hides the scan options (Take photo / Upload from gallery). Hides if already open.

### `window.triggerCamera()` / `window.triggerGallery()`
Programmatically clicks the appropriate hidden file input.

### Image resize helper (internal, not on window)
```javascript
function resizeImage(file, maxPx = 800) {
  // Returns a Promise resolving to { base64, mimeType }
  // Uses Canvas API to resize to maxPx on longest dimension
}
```

### `window.handleScanFile(input)`
Called by the file input's `onchange`. Reads the file, resizes it, shows scan state, POSTs to `/api/scan`, then either shows confirmation panel or triggers error fallback.

### `window.addScannedIngredients()`
Reads checked items from the confirmation panel. For each checked item, calls `window.quickAdd(name, qty)` — the existing function that handles adding ingredients, deduplication (case-insensitive via `parseIngredient()`), tag rendering, and button state update. No separate duplicate check needed — `quickAdd()` already handles it. Calls `dismissScan()` after.

### `window.dismissScan()`
Hides scan options, scan state, confirmation panel, and error state. Resets the file input values to allow re-scanning the same image:
```javascript
document.getElementById('cameraInput').value = '';
document.getElementById('galleryInput').value = '';
```

---

## Duplicate Detection

Handled automatically by `window.quickAdd()`. It calls `parseIngredient()` which lowercases the name, then checks `ingredients.find(i => i.name === name)`. No separate pre-filter should be written — doing so would create divergent logic.

---

## Styling

All new elements follow the existing design system:

| Element | Style |
|---------|-------|
| Camera button | Same as `.add-btn` — terracotta background, white icon, `border-radius: 12px` |
| Scan options | Inline below input row, two pill buttons with terracotta border, `--warm-white` background |
| Scan state | Italic muted text + small spinner (reuses `ringRotate` animation) |
| Confirmation panel | `--warm-white` background, `--shadow-card`, `border-radius: 16px`, slides in with `tagPop`-style animation |
| Checkbox rows | Terracotta accent on checked state |
| Add button | Matches `.generate-btn` styling but smaller |
| Error message | Matches `.error-state` — `#FDE8E8` background, `#C43D3D` text, auto-dismiss after 3s |

---

## Constraints & Non-Changes

- No changes to `api/meals.js`, `api/subscribe.js`, or any existing JS logic
- No changes to the ingredient data structure — scanned items go through `window.quickAdd()`, the same path as quick-add staple buttons
- No new environment variables
- No new npm packages
- Vercel free tier compatible (Haiku vision calls complete well within 10s)
- `vercel.json` requires no changes — default function config applies
- Works on iOS Safari, Android Chrome, and desktop browsers

---

## Out of Scope

- Barcode scanning
- Receipt scanning
- Saving scan history
- Processing multiple images at once
