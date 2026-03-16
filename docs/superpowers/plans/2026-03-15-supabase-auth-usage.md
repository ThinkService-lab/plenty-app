# Auth + Usage Tracking Implementation Plan (Firebase)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google + email magic link login, enforce 2 free generations/day for logged-in users, show login and paywall modals, track usage in Firebase Firestore.

**Architecture:** Anonymous users get 2 lifetime tries (tracked in `localStorage` key `plenty_anon_count`) before a login modal appears. Logged-in users get 2 generations/day enforced server-side via a Firestore transaction. `api/usage.js` exports `checkAndIncrementUsage()` as a named function imported by `api/meals.js` — no HTTP call between functions. Firebase JS SDK v10 loaded from Google CDN on the frontend (ES modules); server side uses `firebase-admin` npm package.

**Tech Stack:** Firebase (Auth + Firestore), Firebase JS SDK CDN v10.12.2, firebase-admin npm package, Vercel serverless functions (ES modules), vanilla JS

---

## Critical codebase rules for implementers

- **All onclick handlers must be `window.X = function`** — the Firebase JS SDK script is `type="module"`, so all functions must be explicitly assigned to `window.*` to be accessible from HTML onclick attributes
- **Never use `innerHTML =` on user-controlled input** — build DOM elements programmatically
- **Branch:** Merged to `main` and shipped to production 2026-03-15. Worktree removed.
- **`FIREBASE_PRIVATE_KEY` must never appear in `index.html`** — server-side only
- **Spec:** `docs/superpowers/specs/2026-03-15-supabase-auth-usage-design.md`

---

## Chunk 1: Firebase setup + api/usage.js

### Task 1: Firebase project setup + package.json (MANUAL — user action required)

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create Firebase project**

1. Go to https://console.firebase.google.com → **Add project**
2. Name: `plentymeals` (or similar), disable Google Analytics (not needed)
3. Wait for provisioning

- [ ] **Step 2: Enable Firebase Authentication**

In Firebase Console → **Authentication → Get started**:
- Enable **Google** provider (sign-in method)
- Enable **Email/Password** provider → toggle **Email link (passwordless sign-in)** ON (this is separate from the password option)
- Under **Settings → Authorized domains**, confirm `localhost` is listed and add `plenty-app-nine.vercel.app`

- [ ] **Step 3: Enable Firestore**

Firebase Console → **Firestore Database → Create database**:
- Start in **production mode** (we use Admin SDK server-side, not client rules for writes)
- Region: `nam5` (US central) or closest to your users
- After creation, go to **Rules** tab and replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /profiles/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
    }
    match /usage/{docId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

Click **Publish**.

- [ ] **Step 4: Get the web app config (for frontend)**

Firebase Console → **Project settings (gear icon) → Your apps → Add app → Web**:
- App nickname: `plenty-web`
- Don't enable Firebase Hosting
- Copy the `firebaseConfig` object — you'll need these values:
  - `apiKey`
  - `authDomain`
  - `projectId`

- [ ] **Step 5: Create service account key (for server-side)**

Firebase Console → **Project settings → Service accounts → Generate new private key**:
- This downloads a JSON file
- You need three values from it:
  - `project_id` → `FIREBASE_PROJECT_ID`
  - `client_email` → `FIREBASE_CLIENT_EMAIL`
  - `private_key` → `FIREBASE_PRIVATE_KEY` (the full PEM string including `-----BEGIN PRIVATE KEY-----`)

- [ ] **Step 6: Add env vars to `.env.local`**

Add to your project root `.env.local`:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

**Important:** Wrap `FIREBASE_PRIVATE_KEY` in double quotes. The `\n` sequences must be literal backslash-n (not actual newlines) in the `.env.local` file.

- [ ] **Step 7: Add env vars to Vercel dashboard**

Vercel → your project → **Settings → Environment Variables** → add all three above (all environments). For `FIREBASE_PRIVATE_KEY`, paste the full PEM value exactly as it appears in the downloaded JSON file.

- [ ] **Step 8: Create package.json**

In the project root, create `package.json`:

```json
{
  "name": "plenty-app",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "firebase-admin": "^12.0.0"
  }
}
```

- [ ] **Step 9: Install dependencies**

```bash
cd .worktrees/supabase-auth
npm install
```

Expected: `node_modules/` created with `firebase-admin` and its dependencies.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add firebase-admin dependency"
```

---

### Task 2: Create api/usage.js

**Files:**
- Create: `api/usage.js`

This file has two responsibilities:
1. Named export `checkAndIncrementUsage(idToken)` — imported by `api/meals.js`
2. Default export GET handler — called by frontend on app load to get current usage count

- [ ] **Step 1: Create api/usage.js with full implementation**

```javascript
// api/usage.js
// ── Shared utility: checkAndIncrementUsage
// Imported by api/meals.js — NOT called via HTTP between functions.
//
// GET /api/usage — returns { count, limit, plan } for authenticated user.
// Frontend calls this on app load to populate the usage indicator.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// ── Initialise Firebase Admin (singleton — safe to call multiple times in Vercel)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel stores \n as literal \n in env vars — replace them
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const adminAuth = getAuth();
const db = getFirestore();

// ── In-memory rate limiter (same pattern as meals.js / scan.js)
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

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

const PLAN_LIMITS = { free: 2, standard: 15, unlimited: Infinity };

// ── Get or create the user's profile document
async function getUserPlan(uid) {
  const ref = db.collection('profiles').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    // First time this user hits the API — create their profile
    await ref.set({ plan: 'free', createdAt: new Date().toISOString() });
    return 'free';
  }
  return snap.data().plan || 'free';
}

// ── Today's date as YYYY-MM-DD (UTC)
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// ── Atomic check-and-increment via Firestore transaction
// Returns: { count, limited }
async function atomicIncrement(uid, limit) {
  const today = todayUTC();
  const docId = `${uid}_${today}`;
  const ref = db.collection('usage').doc(docId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data().count || 0) : 0;

    if (current >= limit) {
      return { count: current, limited: true };
    }

    const newCount = current + 1;
    tx.set(ref, { userId: uid, date: today, count: newCount }, { merge: true });
    return { count: newCount, limited: false };
  });
}

// ── Get today's count without incrementing (used by GET /api/usage)
async function getTodayCount(uid) {
  const docId = `${uid}_${todayUTC()}`;
  const snap = await db.collection('usage').doc(docId).get();
  return snap.exists ? (snap.data().count || 0) : 0;
}

// ── Main exported function — used by api/meals.js
// Returns one of:
//   { error: 'unauthorized' }         — invalid/expired token
//   { error: 'service_unavailable' }  — Firebase auth unreachable
//   { error: 'limit_reached' }        — daily limit already hit
//   { count, limit, plan }            — success, proceed with generation
export async function checkAndIncrementUsage(idToken) {
  // 1. Validate token — if Firebase auth is unreachable, fail closed (not open)
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (e) {
    // verifyIdToken throws for invalid tokens AND for network errors
    const isNetworkError = e.code === 'auth/network-request-failed';
    return { error: isNetworkError ? 'service_unavailable' : 'unauthorized' };
  }
  const uid = decodedToken.uid;

  // 2. Get user's plan
  let plan;
  try {
    plan = await getUserPlan(uid);
  } catch (e) {
    plan = 'free'; // fail open for profile read
  }
  const limit = PLAN_LIMITS[plan] ?? 2;

  // 3. Unlimited plan — skip DB write entirely
  if (limit === Infinity) return { count: 0, limit: Infinity, plan };

  // 4. Atomic check-and-increment
  let result;
  try {
    result = await atomicIncrement(uid, limit);
  } catch (e) {
    // Firestore write failed — fail open: allow generation, don't block user
    console.error('[usage] atomicIncrement failed for uid', uid, e.message);
    return { count: 0, limit, plan };
  }

  if (result.limited) return { error: 'limit_reached' };
  return { count: result.count, limit, plan };
}

// ── GET /api/usage — returns current count for authenticated user
// Called by frontend on app load after session is restored
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (e) {
    const isNetworkError = e.code === 'auth/network-request-failed';
    return res.status(isNetworkError ? 503 : 401).json({
      error: isNetworkError ? 'Service unavailable' : 'Unauthorized'
    });
  }
  const uid = decodedToken.uid;

  const plan = await getUserPlan(uid).catch(() => 'free');
  const limit = PLAN_LIMITS[plan] ?? 2;
  const count = await getTodayCount(uid).catch(() => 0);

  return res.status(200).json({ count, limit, plan });
}
```

- [ ] **Step 2: Verify file syntax**

```bash
node --check api/usage.js
```

Expected: no output (clean pass).

- [ ] **Step 3: Commit**

```bash
git add api/usage.js
git commit -m "feat: add api/usage.js — Firebase checkAndIncrementUsage + GET endpoint"
```

---

## Chunk 2: Update api/meals.js

### Task 3: Add auth + usage check to api/meals.js

**Files:**
- Modify: `api/meals.js`

Changes required:
1. Import `checkAndIncrementUsage` from `./usage.js`
2. Add `Authorization` to `Access-Control-Allow-Headers`
3. After rate limit check: extract Authorization header, call `checkAndIncrementUsage`, handle errors
4. Include `usage: { count, limit }` in success responses

- [ ] **Step 1: Open api/meals.js and add the import at the very top**

Add as the first line of the file:
```javascript
import { checkAndIncrementUsage } from './usage.js';
```

- [ ] **Step 2: Update the CORS Allow-Headers line**

Change:
```javascript
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```
To:
```javascript
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
```

- [ ] **Step 3: Add usage check block after the rate limit block**

Insert this block after `if (isRateLimited(ip)) { ... }` and before `const body = req.body || {}`:

```javascript
  // ── Usage check (authenticated requests only)
  // Anonymous requests (no Authorization header) pass through — client enforces the 2-try anon limit.
  const authHeader = req.headers['authorization'];
  let usageData = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const usageResult = await checkAndIncrementUsage(token);

    if (usageResult.error === 'unauthorized') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    if (usageResult.error === 'service_unavailable') {
      return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
    }
    if (usageResult.error === 'limit_reached') {
      const now = new Date();
      const tomorrow = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
      ));
      return res.status(429).json({
        error: 'limit_reached',
        resets_at: tomorrow.toISOString()
      });
    }
    usageData = { count: usageResult.count, limit: usageResult.limit };
  }
```

- [ ] **Step 4: Include usageData in both success response paths**

Find the two `return res.status(200).json(...)` lines inside the try block and update them:

```javascript
// clean parse success:
return res.status(200).json({ clean: true, parsed, usage: usageData });

// raw fallback:
return res.status(200).json({ clean: false, raw: jsonStr, usage: usageData });
```

- [ ] **Step 5: Verify syntax**

```bash
node --check api/meals.js
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add api/meals.js
git commit -m "feat: add auth + usage check to api/meals.js"
```

---

## Chunk 3: index.html — CSS + HTML

### Task 4: Add auth CSS to index.html

**Files:**
- Modify: `index.html` (CSS section only)

- [ ] **Step 1: Find the insertion point for new CSS**

Open `index.html`. Search for `.scan-error` CSS rule (the last rule added in the previous feature). Insert the new CSS block immediately after it.

- [ ] **Step 2: Insert the auth CSS block**

```css
    /* ── Auth chip ── */
    /* Note: .hero-content already has position:relative — do not add it again */
    .auth-chip {
      position: absolute;
      top: 12px;
      right: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .auth-initial {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--terracotta);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      flex-shrink: 0;
    }
    .auth-email-text {
      font-size: 12px;
      color: var(--muted);
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .auth-signout-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      background: var(--warm-white);
      border-radius: 10px;
      box-shadow: var(--shadow-card);
      padding: 8px 14px;
      font-size: 13px;
      color: var(--terracotta);
      white-space: nowrap;
      cursor: pointer;
      z-index: 10;
    }

    /* ── Auth modals (login + paywall share this base) ── */
    .auth-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .auth-modal-card {
      background: var(--warm-white);
      border-radius: 20px;
      padding: 32px 28px;
      max-width: 340px;
      width: calc(100% - 40px);
      box-shadow: var(--shadow-card);
      text-align: center;
      animation: authSlideUp 0.3s var(--spring);
    }
    @keyframes authSlideUp {
      from { transform: translateY(40px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    .auth-modal-icon { font-size: 32px; margin-bottom: 12px; }
    .auth-modal-title {
      font-family: 'Playfair Display', serif;
      font-size: 22px;
      font-weight: 700;
      color: var(--earth);
      margin-bottom: 8px;
    }
    .auth-modal-subtitle {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .auth-btn-primary {
      width: 100%;
      padding: 13px;
      border-radius: 12px;
      background: var(--terracotta);
      color: #fff;
      font-weight: 600;
      font-size: 15px;
      border: none;
      cursor: pointer;
      margin-bottom: 10px;
      font-family: 'DM Sans', sans-serif;
    }
    .auth-btn-secondary {
      width: 100%;
      padding: 13px;
      border-radius: 12px;
      background: transparent;
      color: var(--terracotta);
      font-weight: 600;
      font-size: 15px;
      border: 2px solid var(--terracotta);
      cursor: pointer;
      margin-bottom: 10px;
      font-family: 'DM Sans', sans-serif;
    }
    .auth-email-input {
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      border: 1.5px solid #ddd;
      font-size: 15px;
      margin-bottom: 8px;
      box-sizing: border-box;
      font-family: 'DM Sans', sans-serif;
    }
    .auth-btn-send {
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      background: var(--terracotta);
      color: #fff;
      font-weight: 600;
      font-size: 14px;
      border: none;
      cursor: pointer;
      margin-bottom: 8px;
      font-family: 'DM Sans', sans-serif;
    }
    .auth-magic-sent {
      font-size: 14px;
      color: var(--sage);
      margin-bottom: 8px;
    }
    .auth-modal-note {
      font-size: 12px;
      color: var(--muted);
      margin-top: 12px;
    }

    /* ── Paywall plan cards ── */
    .paywall-plans {
      display: flex;
      gap: 10px;
      margin-bottom: 8px;
    }
    .paywall-plan {
      flex: 1;
      border: 2px solid #eee;
      border-radius: 14px;
      padding: 14px 10px;
      text-align: center;
    }
    .paywall-plan-featured { border-color: var(--terracotta); background: #FDF6F0; }
    .paywall-plan-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .paywall-plan-price {
      font-size: 19px;
      font-weight: 800;
      color: var(--earth);
      margin-bottom: 2px;
    }
    .paywall-plan-desc {
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 10px;
    }
    .paywall-plan-btn {
      width: 100%;
      padding: 8px;
      border-radius: 8px;
      background: #eee;
      color: #aaa;
      font-size: 12px;
      border: none;
      cursor: not-allowed;
      font-family: 'DM Sans', sans-serif;
    }

    /* ── Usage indicator ── */
    .usage-indicator {
      font-size: 13px;
      color: var(--muted);
      text-align: center;
      margin-top: 8px;
    }
```

- [ ] **Step 3: Verify no broken braces**

Count opening `{` and closing `}` in the block you just added — they must be equal. Open `vercel dev` and check the browser console at http://localhost:3000 — it should be free of CSS parse errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add auth CSS to index.html"
```

---

### Task 5: Add auth HTML to index.html

**Files:**
- Modify: `index.html` (HTML section only)

Four HTML additions needed:

**A. Firebase CDN scripts** — in `<head>`, before the closing `</head>` tag:

- [ ] **Step 1: Add Firebase script tags to `<head>`**

Find the closing `</head>` tag and insert before it:

```html
  <!-- Firebase JS SDK v10 (ES modules from CDN) -->
  <script type="module" src="/firebase-init.js"></script>
```

Wait — Firebase v10 is ES module only and cannot be loaded as a plain script tag with `window` globals the same way Supabase's UMD bundle could. Instead, use an **inline module script** in `index.html`. Replace the above with this inline approach (add just before `</body>`, not `</head>`, so the DOM is ready):

Actually, place the Firebase module script as the **very first** `<script type="module">` tag just before the closing `</body>` tag, **before** the existing inline `<script>` block (which must remain `type="text/javascript"` or no type). See Task 6 Step 1 for the full Firebase init script — the HTML placeholder here is just a marker comment:

```html
  <!-- Firebase auth module script inserted here in Task 6 -->
```

Add this comment just before the closing `</body>` tag as a placeholder. The actual Firebase script is added in Task 6.

**B. Auth chip** — inside `.hero-content`, as the last child before its closing tag:

- [ ] **Step 2: Find `.hero-content` and add the auth chip**

Search for `class="hero-content"`. Inside that div, add as the last child:

```html
        <div id="authChip" class="auth-chip" style="display:none" onclick="window.toggleSignOutDropdown()">
          <div id="authInitial" class="auth-initial"></div>
          <span id="authEmailText" class="auth-email-text"></span>
          <div id="authSignOutDropdown" class="auth-signout-dropdown" style="display:none" onclick="window.signOut()">Sign out</div>
        </div>
```

**C. Usage indicator** — immediately after the generate button (`id="generateBtn"`):

- [ ] **Step 3: Find the generate button and add usage indicator after it**

Search for `id="generateBtn"`. Immediately after that button's closing tag, add:

```html
      <p id="usageIndicator" class="usage-indicator" style="display:none"></p>
```

**D. Login and paywall modals** — just before the closing `</body>` tag (after the placeholder comment added in Step 1):

- [ ] **Step 4: Add both modals before `</body>`**

```html
  <!-- ── Login modal ── -->
  <div id="loginModal" class="auth-modal-backdrop" style="display:none" onclick="window.handleLoginBackdropClick(event)">
    <div class="auth-modal-card">
      <div class="auth-modal-icon">🌿</div>
      <h3 class="auth-modal-title">You're on a roll!</h3>
      <p class="auth-modal-subtitle">Save your spot and keep the ideas coming — free account, 30 seconds.</p>
      <button class="auth-btn-primary" onclick="window.signInWithGoogle()">Continue with Google</button>
      <button class="auth-btn-secondary" onclick="window.showEmailInput()">Continue with Email</button>
      <div id="emailInputArea" style="display:none">
        <input type="email" id="magicLinkEmail" class="auth-email-input" placeholder="your@email.com">
        <button class="auth-btn-send" onclick="window.sendMagicLink()">Send magic link →</button>
        <p id="magicLinkSent" class="auth-magic-sent" style="display:none">Check your inbox ✉️</p>
      </div>
      <p class="auth-modal-note">No password needed · Free forever</p>
    </div>
  </div>

  <!-- ── Paywall modal ── -->
  <div id="paywallModal" class="auth-modal-backdrop" style="display:none" onclick="window.handlePaywallBackdropClick(event)">
    <div class="auth-modal-card">
      <div class="auth-modal-icon">🌿</div>
      <h3 class="auth-modal-title">You're eating well today!</h3>
      <p class="auth-modal-subtitle">You've used your 2 free meal plans. Upgrade for more — or come back tomorrow.</p>
      <div class="paywall-plans">
        <div class="paywall-plan">
          <div class="paywall-plan-label">Standard</div>
          <div id="paywallPriceStandard" class="paywall-plan-price"></div>
          <div class="paywall-plan-desc">15 meal plans/day</div>
          <button class="paywall-plan-btn" disabled>Coming soon</button>
        </div>
        <div class="paywall-plan paywall-plan-featured">
          <div class="paywall-plan-label">Unlimited</div>
          <div id="paywallPriceUnlimited" class="paywall-plan-price"></div>
          <div class="paywall-plan-desc">Unlimited</div>
          <button class="paywall-plan-btn" disabled>Coming soon</button>
        </div>
      </div>
      <p id="paywallResetNote" class="auth-modal-note">Or wait until midnight — your free 2 reset daily</p>
    </div>
  </div>
```

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add auth + paywall HTML to index.html"
```

---

## Chunk 4: index.html — JavaScript

### Task 6: Add Firebase auth JS + update generateMeals in index.html

**Files:**
- Modify: `index.html` (add one `<script type="module">` block + update existing `<script>` block)

**Important:** Firebase v10 uses ES module imports. All auth code goes in a `<script type="module">` block. The existing inline `<script>` block (no type, or `type="text/javascript"`) is separate and cannot import ES modules. Functions needed by onclick handlers must be explicitly assigned to `window.*` inside the module script.

- [ ] **Step 1: Add the Firebase module script**

Find the `<!-- Firebase auth module script inserted here in Task 6 -->` comment added in Task 5 Step 1. Replace that comment with this full module script:

```html
  <script type="module">
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
    import {
      getAuth,
      GoogleAuthProvider,
      signInWithPopup,
      sendSignInLinkToEmail,
      isSignInWithEmailLink,
      signInWithEmailLink,
      onAuthStateChanged,
      signOut as firebaseSignOut
    } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

    // ── Firebase config (public values — safe to hardcode)
    const firebaseConfig = {
      apiKey: 'REPLACE_WITH_YOUR_FIREBASE_API_KEY',
      authDomain: 'REPLACE_WITH_YOUR_AUTH_DOMAIN',
      projectId: 'REPLACE_WITH_YOUR_PROJECT_ID'
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const googleProvider = new GoogleAuthProvider();

    // ── State (shared with the existing script via window globals)
    window._firebaseAuth = auth;
    window._currentUser = null;
    window._currentUsagePlan = 'free';

    // ── Anonymous counter helpers
    window.getAnonCount = function() {
      return parseInt(localStorage.getItem('plenty_anon_count') || '0', 10);
    };
    window.incrementAnonCount = function() {
      localStorage.setItem('plenty_anon_count', String(window.getAnonCount() + 1));
    };
    window.resetAnonCount = function() {
      localStorage.removeItem('plenty_anon_count');
    };

    // ── Auth chip
    window.renderAuthChip = function(user) {
      var emailStr = (user && user.email) ? user.email : '';
      var el = document.getElementById('authInitial');
      if (el) el.textContent = emailStr.charAt(0).toUpperCase();
      var emailEl = document.getElementById('authEmailText');
      if (emailEl) emailEl.textContent = emailStr.length > 20 ? emailStr.slice(0, 20) + '\u2026' : emailStr;
      var chip = document.getElementById('authChip');
      if (chip) chip.style.display = 'flex';
    };
    window.hideAuthChip = function() {
      var chip = document.getElementById('authChip');
      if (chip) chip.style.display = 'none';
      var dropdown = document.getElementById('authSignOutDropdown');
      if (dropdown) dropdown.style.display = 'none';
    };
    window.toggleSignOutDropdown = function() {
      var dropdown = document.getElementById('authSignOutDropdown');
      if (!dropdown) return;
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    };

    // ── Usage indicator
    window.updateUsageIndicator = function(count, limit, plan) {
      window._currentUsagePlan = plan || 'free';
      var el = document.getElementById('usageIndicator');
      if (!el) return;
      if (!window._currentUser || plan !== 'free') { el.style.display = 'none'; return; }
      el.textContent = count + ' of ' + limit + ' free meal plans used today';
      el.style.display = 'block';
    };
    window.hideUsageIndicator = function() {
      var el = document.getElementById('usageIndicator');
      if (el) el.style.display = 'none';
    };
    window.fetchAndRenderUsage = async function() {
      if (!window._currentUser) return;
      try {
        var token = await window._currentUser.getIdToken();
        var res = await fetch('/api/usage', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
          var data = await res.json();
          window.updateUsageIndicator(data.count, data.limit, data.plan);
        }
      } catch (e) { /* non-critical — indicator stays hidden */ }
    };

    // ── Login modal
    window.showLoginModal = function() {
      var modal = document.getElementById('loginModal');
      if (modal) modal.style.display = 'flex';
    };
    window.hideLoginModal = function() {
      var modal = document.getElementById('loginModal');
      if (modal) modal.style.display = 'none';
      var area = document.getElementById('emailInputArea');
      if (area) area.style.display = 'none';
      var input = document.getElementById('magicLinkEmail');
      if (input) input.value = '';
      var sent = document.getElementById('magicLinkSent');
      if (sent) sent.style.display = 'none';
    };
    window.handleLoginBackdropClick = function(e) {
      if (e.target && e.target.id === 'loginModal') window.hideLoginModal();
    };
    window.signInWithGoogle = async function() {
      try {
        await signInWithPopup(auth, googleProvider);
        // onAuthStateChanged fires and handles the rest
      } catch (e) {
        if (e.code !== 'auth/popup-closed-by-user') {
          console.error('[auth] Google sign-in error', e.message);
        }
      }
    };
    window.showEmailInput = function() {
      var area = document.getElementById('emailInputArea');
      if (area) area.style.display = 'block';
    };
    window.sendMagicLink = async function() {
      var emailEl = document.getElementById('magicLinkEmail');
      var email = emailEl ? emailEl.value.trim() : '';
      if (!email) return;
      var actionCodeSettings = {
        url: window.location.origin,
        handleCodeInApp: true
      };
      try {
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        localStorage.setItem('plenty_email_for_signin', email);
        var sent = document.getElementById('magicLinkSent');
        if (sent) sent.style.display = 'block';
      } catch (e) {
        console.error('[auth] send magic link error', e.message);
      }
    };

    // ── Paywall modal
    window.showPaywallModal = function(resetsAt) {
      var modal = document.getElementById('paywallModal');
      if (!modal) return;
      modal.style.display = 'flex';
      var locale = navigator.language || 'en-US';
      var currencyMap = { 'en-CA': 'CAD', 'fr-CA': 'CAD', 'en-GB': 'GBP', 'en-AU': 'AUD', 'en-NZ': 'NZD' };
      var currency = currencyMap[locale] || 'USD';
      var fmt = new Intl.NumberFormat(locale, { style: 'currency', currency: currency, minimumFractionDigits: 2 });
      var stdEl = document.getElementById('paywallPriceStandard');
      if (stdEl) stdEl.textContent = fmt.format(4.99) + '/mo';
      var unlEl = document.getElementById('paywallPriceUnlimited');
      if (unlEl) unlEl.textContent = fmt.format(9.99) + '/mo';
      if (resetsAt) {
        var resetTime = new Date(resetsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        var noteEl = document.getElementById('paywallResetNote');
        if (noteEl) noteEl.textContent = 'Your 2 free plans reset at ' + resetTime;
      }
    };
    window.handlePaywallBackdropClick = function(e) {
      if (e.target && e.target.id === 'paywallModal') {
        var modal = document.getElementById('paywallModal');
        if (modal) modal.style.display = 'none';
      }
    };

    // ── Sign out
    window.signOut = async function() {
      await firebaseSignOut(auth);
      window._currentUser = null;
      window._currentUsagePlan = 'free';
      window.resetAnonCount();
      window.hideAuthChip();
      window.hideUsageIndicator();
    };

    // ── Handle email link sign-in on page load (must check before onAuthStateChanged)
    if (isSignInWithEmailLink(auth, window.location.href)) {
      var emailForSignIn = localStorage.getItem('plenty_email_for_signin');
      if (emailForSignIn) {
        signInWithEmailLink(auth, emailForSignIn, window.location.href)
          .then(function() {
            localStorage.removeItem('plenty_email_for_signin');
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
          })
          .catch(function(e) { console.error('[auth] email link sign-in error', e.message); });
      }
    }

    // ── Auth state listener
    onAuthStateChanged(auth, async function(user) {
      window._currentUser = user;
      if (user) {
        window.renderAuthChip(user);
        await window.fetchAndRenderUsage();
        window.hideLoginModal();
      } else {
        window.hideAuthChip();
        window.hideUsageIndicator();
      }
    });
  </script>
```

Replace `REPLACE_WITH_YOUR_FIREBASE_API_KEY`, `REPLACE_WITH_YOUR_AUTH_DOMAIN`, and `REPLACE_WITH_YOUR_PROJECT_ID` with your actual Firebase project values.

- [ ] **Step 2: Update generateMeals — add anon gate at the top**

Find `window.generateMeals = async function() {`. Insert immediately after the opening brace:

```javascript
    // Gate anonymous users after 2 tries
    if (!window._currentUser && window.getAnonCount() >= 2) {
      window.showLoginModal();
      return;
    }
```

- [ ] **Step 3: Update generateMeals — add Authorization header to fetch**

Find the `fetch('/api/meals', {` call. Change the `headers` object from:
```javascript
headers: { 'Content-Type': 'application/json' },
```
to:
```javascript
headers: (function() {
  var h = { 'Content-Type': 'application/json' };
  if (window._currentUser) {
    // getIdToken() is async — we store the token before calling fetch
    // See Step 4 for the token pre-fetch
  }
  return h;
})(),
```

Actually, because `getIdToken()` is async and the headers object is built inline, use a pre-fetch approach. **Replace Steps 3 and 4 with this combined approach:**

Find the line that starts the fetch call (something like `const response = await fetch('/api/meals', {`) and replace the entire fetch setup with:

```javascript
      // Get fresh ID token for authenticated users
      var authHeaders = {};
      if (window._currentUser) {
        try {
          var idToken = await window._currentUser.getIdToken();
          authHeaders = { 'Authorization': 'Bearer ' + idToken };
        } catch (e) { /* token fetch failed — proceed as anonymous */ }
      }

      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders),
        body: JSON.stringify({ ... })  // keep existing body unchanged
      });
```

**Important:** Keep the `body: JSON.stringify(...)` line exactly as it was — only modify the `headers` line.

- [ ] **Step 4: Update generateMeals — add 401 and limit_reached handling**

Find `const data = await response.json()`. Insert after it (before the existing `if (!response.ok) throw new Error(...)` line):

```javascript
      // Handle usage limit reached
      if (response.status === 429 && data.error === 'limit_reached') {
        clearTimeout(slowTimer);
        document.getElementById('loadingState').classList.remove('active');
        document.getElementById('generateBtn').style.display = 'flex';
        window.showPaywallModal(data.resets_at);
        return;
      }
      // Handle expired session
      if (response.status === 401) {
        clearTimeout(slowTimer);
        document.getElementById('loadingState').classList.remove('active');
        document.getElementById('generateBtn').style.display = 'flex';
        if (window._firebaseAuth) await firebaseSignOut(window._firebaseAuth).catch(() => {});
        window._currentUser = null;
        window.hideAuthChip();
        window.showLoginModal();
        return;
      }
```

**Note:** `firebaseSignOut` is not in scope inside the existing script block. Replace the sign-out call with:
```javascript
        if (window.signOut) await window.signOut();
```

- [ ] **Step 5: Update generateMeals — increment anon count + update usage indicator on success**

Find the `renderResults(...)` call in the success path. After it, add:

```javascript
      // Track anonymous usage
      if (!window._currentUser) window.incrementAnonCount();
      // Update usage indicator for logged-in free users
      if (data.usage) window.updateUsageIndicator(data.usage.count, data.usage.limit, window._currentUsagePlan);
```

- [ ] **Step 6: Verify in browser**

```bash
vercel dev
```

Open http://localhost:3000 — browser DevTools console must be clean (no auth errors, no "window.getAnonCount is not a function", no Firebase init errors). The Firebase module script loads asynchronously so functions on `window.*` are available after the module executes.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: add Firebase auth JS + update generateMeals"
```

---

## Chunk 5: E2E verification + merge

### Task 7: End-to-end verification

**Files:**
- No code changes — testing only

- [ ] **Step 1: Start local dev server**

```bash
vercel dev
```

Open http://localhost:3000.

- [ ] **Step 2: Test anonymous limit gate**

1. Open DevTools → Application → Local Storage → clear `plenty_anon_count`
2. Add ingredients → Generate meals twice → both should succeed
3. Try to generate a 3rd time → login modal should appear with 🌿 icon, Google button, Email button
4. Click backdrop → modal closes
5. Try Generate again → login modal re-appears

Expected: ✅ modal appears on 3rd anonymous attempt

- [ ] **Step 3: Test email magic link flow**

1. In the login modal, click "Continue with Email"
2. Email input area appears
3. Enter a real email → click "Send magic link"
4. See "Check your inbox ✉️" message
5. Check email inbox — click the link
6. App reopens with session active
7. Auth chip appears top-right
8. Usage indicator shows "0 of 2 free meal plans used today"

Expected: ✅ auth chip visible, usage indicator shows 0 of 2

- [ ] **Step 4: Test usage tracking**

1. While logged in, generate 2 meals
2. Usage indicator increments: "1 of 2...", then "2 of 2..."
3. Generate a 3rd time → paywall modal appears with plan pricing in correct currency (CAD for Canadian locale)
4. Paywall modal shows the reset time from the server
5. Click backdrop → modal closes

Expected: ✅ paywall appears on 3rd logged-in generation

- [ ] **Step 5: Test sign out**

1. Click auth chip → "Sign out" dropdown appears
2. Click "Sign out"
3. Auth chip hides, usage indicator hides
4. `plenty_anon_count` reset to 0 in DevTools → Local Storage

Expected: ✅ clean sign-out state

- [ ] **Step 6: Test Google OAuth (works on localhost with popup)**

1. On http://localhost:3000, click Generate 3 times to trigger login modal
2. Click "Continue with Google" → Google sign-in popup appears
3. Complete sign-in → popup closes, auth chip appears, usage indicator shows

Expected: ✅ Google sign-in works

- [ ] **Step 7: Run node --check on backend files**

```bash
node --check api/usage.js && node --check api/meals.js && echo "✅ all clear"
```

Expected: `✅ all clear`

- [ ] **Step 8: Merge to main**

```bash
git checkout main
git pull
git merge supabase-auth
git push origin main
git branch -d supabase-auth
```

- [ ] **Step 9: Final production smoke test**

Open https://plenty-app-nine.vercel.app:
1. Generate meals anonymously twice → 3rd attempt shows login modal ✅
2. Sign in → auth chip appears ✅
3. Generate 2 meals → usage indicator updates ✅
4. 3rd generation → paywall modal ✅
