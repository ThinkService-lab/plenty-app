# Supabase Auth + Usage Tracking Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google + email magic link login, enforce 2 free generations/day for logged-in users, show login and paywall modals, track usage in Supabase.

**Architecture:** Anonymous users get 2 lifetime tries (tracked in localStorage) before a login modal appears. Logged-in users get 2 generations/day enforced server-side via an atomic Postgres upsert. `api/usage.js` exports `checkAndIncrementUsage()` as a named function imported by `api/meals.js` — no HTTP call between functions. Supabase JS loaded from CDN on the frontend; server side uses raw `fetch()` against Supabase REST endpoints — no npm packages added.

**Tech Stack:** Supabase (Auth + Postgres), Supabase JS CDN v2.39.7, Vercel serverless functions (ES modules), vanilla JS

---

## Critical codebase rules for implementers

- **All onclick handlers must be `window.X = function`** — functions inside `<script>` are not globally scoped
- **Never use `innerHTML =` on user-controlled input** — build DOM elements programmatically
- **Branch:** all work on `supabase-auth` branch, never `main`
- **No npm packages** — use `fetch()` for Supabase REST API calls server-side
- **`SUPABASE_SERVICE_ROLE_KEY` must never appear in `index.html`** — server-side only
- **Spec:** `docs/superpowers/specs/2026-03-15-supabase-auth-usage-design.md`

---

## Chunk 1: Supabase setup + api/usage.js

### Task 1: Create branch + Supabase project + database schema

**Files:**
- No code changes — manual Supabase setup steps

- [ ] **Step 1: Create the feature branch**

```bash
git checkout main && git pull
git checkout -b supabase-auth
```

- [ ] **Step 2: Create Supabase project**

1. Go to https://supabase.com, sign in, click "New project"
2. Name: `plentymeals`, region: closest to your users (e.g. US East), generate a strong password
3. Wait for project to finish provisioning (~2 min)
4. Note your project URL and keys from **Settings → API**:
   - `Project URL` → this is `SUPABASE_URL`
   - `anon / public` key → this is `SUPABASE_ANON_KEY`
   - `service_role / secret` key → this is `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

- [ ] **Step 3: Run the database schema SQL**

In the Supabase dashboard → **SQL Editor** → New query — paste and run this entire block:

```sql
-- ── profiles table (one row per user, plan defaults to 'free')
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'standard', 'unlimited')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

-- ── usage table (one row per user per UTC day)
CREATE TABLE usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, date)
);
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own usage"
  ON usage FOR SELECT USING (auth.uid() = user_id);

-- ── Auto-create profile row on new signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Atomic usage increment stored procedure
-- Returns: [{count: integer, limited: boolean}]
-- 'limited' = true means the limit was already reached (upsert did not fire)
CREATE OR REPLACE FUNCTION increment_usage(p_user_id uuid, p_limit integer)
RETURNS TABLE(count integer, limited boolean)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count integer;
  v_limited boolean;
BEGIN
  WITH upserted AS (
    INSERT INTO usage (user_id, date, count)
    VALUES (p_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, date)
    DO UPDATE SET count = usage.count + 1
    WHERE usage.count < p_limit
    RETURNING usage.count
  )
  SELECT upserted.count INTO v_count FROM upserted;

  IF v_count IS NULL THEN
    v_limited := true;
    SELECT usage.count INTO v_count
    FROM usage
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
  ELSE
    v_limited := false;
  END IF;

  RETURN QUERY SELECT v_count, v_limited;
END;
$$;
```

Expected: all statements complete with no errors.

- [ ] **Step 4: Enable Google OAuth in Supabase**

1. Supabase dashboard → **Authentication → Providers → Google** → toggle Enable
2. You need a Google OAuth client ID and secret. Go to https://console.cloud.google.com:
   - Create a new project (or use existing)
   - APIs & Services → Credentials → Create credentials → OAuth client ID
   - Application type: Web application
   - Authorised redirect URIs: add `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Paste Client ID and Client Secret back into the Supabase Google provider form → Save

- [ ] **Step 5: Configure redirect URLs**

Supabase dashboard → **Authentication → URL Configuration**:
- Site URL: `https://plenty-app-nine.vercel.app`
- Redirect URLs (add both):
  - `http://localhost:3000`
  - `https://plenty-app-nine.vercel.app`

- [ ] **Step 6: Add env vars to local dev**

Add to `.env.local` (create if it doesn't exist):
```
ANTHROPIC_API_KEY=<existing value>
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

- [ ] **Step 7: Add env vars to Vercel dashboard**

Vercel dashboard → your project → **Settings → Environment Variables** → add:
- `SUPABASE_URL` — all environments
- `SUPABASE_ANON_KEY` — all environments
- `SUPABASE_SERVICE_ROLE_KEY` — all environments (this is secret — never put it in `index.html`)

- [ ] **Step 8: Commit the branch (no code yet — just note the setup)**

```bash
git commit --allow-empty -m "chore: start supabase-auth branch — Supabase project created"
```

---

### Task 2: Create api/usage.js

**Files:**
- Create: `api/usage.js`

This file has two responsibilities:
1. Named export `checkAndIncrementUsage(accessToken)` — imported by `api/meals.js`
2. Default export GET handler — called by frontend on app load to get current usage count

- [ ] **Step 1: Create api/usage.js with full implementation**

```javascript
// api/usage.js
// ── Shared utility: checkAndIncrementUsage
// Imported by api/meals.js — NOT called via HTTP between functions.
//
// GET /api/usage — returns { count, limit, plan } for authenticated user.
// Frontend calls this on app load to populate the usage indicator.

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

// ── Supabase helpers (raw fetch — no npm dependency)

async function getUser(accessToken) {
  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': process.env.SUPABASE_ANON_KEY
    }
  });
  if (!res.ok) return null;
  return res.json();
}

async function getUserPlan(userId) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=plan`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    }
  );
  if (!res.ok) return 'free';
  const rows = await res.json();
  return rows[0]?.plan || 'free';
}

async function atomicIncrement(userId, limit) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/increment_usage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
    },
    body: JSON.stringify({ p_user_id: userId, p_limit: limit })
  });
  if (!res.ok) return null; // fail open — usage write failure allows generation
  const data = await res.json();
  return data[0] || null; // Postgres function returns array of rows
}

async function getTodayCount(userId) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/usage?user_id=eq.${userId}&date=eq.${today}&select=count`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    }
  );
  if (!res.ok) return 0;
  const rows = await res.json();
  return rows[0]?.count || 0;
}

// ── Main exported function — used by api/meals.js
// Returns one of:
//   { error: 'unauthorized' }         — invalid/expired token
//   { error: 'service_unavailable' }  — Supabase auth endpoint unreachable
//   { error: 'limit_reached' }        — daily limit already hit
//   { count, limit, plan }            — success, proceed with generation
export async function checkAndIncrementUsage(accessToken) {
  // 1. Validate token — if Supabase auth is unreachable, fail closed (not open)
  let user;
  try {
    user = await getUser(accessToken);
  } catch (e) {
    return { error: 'service_unavailable' };
  }
  if (!user || !user.id) return { error: 'unauthorized' };

  // 2. Get user's plan
  const plan = await getUserPlan(user.id);
  const limit = PLAN_LIMITS[plan] ?? 2;

  // 3. Unlimited plan — skip DB write entirely
  if (limit === Infinity) return { count: 0, limit: Infinity, plan };

  // 4. Atomic check-and-increment
  const result = await atomicIncrement(user.id, limit);
  if (!result) {
    // DB write failed — fail open: allow generation, don't block user
    console.error('[usage] atomicIncrement failed for user', user.id);
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

  let user;
  try {
    user = await getUser(token);
  } catch (e) {
    return res.status(503).json({ error: 'Service unavailable' });
  }
  if (!user || !user.id) return res.status(401).json({ error: 'Unauthorized' });

  const plan = await getUserPlan(user.id);
  const limit = PLAN_LIMITS[plan] ?? 2;
  const count = await getTodayCount(user.id);

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
git commit -m "feat: add api/usage.js — checkAndIncrementUsage + GET endpoint"
```

---

## Chunk 2: Update api/meals.js

### Task 3: Add auth + usage check to api/meals.js

**Files:**
- Modify: `api/meals.js`

Changes required:
1. Import `checkAndIncrementUsage` from `./usage.js`
2. Add `Authorization` to `Access-Control-Allow-Headers` (currently only `Content-Type`)
3. After rate limit check: extract Authorization header, call `checkAndIncrementUsage`, handle errors
4. Include `usage: { count, limit }` in success responses

- [ ] **Step 1: Open api/meals.js and add the import at the very top**

Add as the first line of the file:
```javascript
import { checkAndIncrementUsage } from './usage.js';
```

- [ ] **Step 2: Update the CORS Allow-Headers line (line 48)**

Change:
```javascript
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```
To:
```javascript
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
```

- [ ] **Step 3: Add usage check block after the rate limit block (after line 60)**

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
// Line ~110 — clean parse success:
return res.status(200).json({ clean: true, parsed, usage: usageData });

// Line ~112 — raw fallback:
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
    /* Note: .hero-content { position: relative } already exists in the CSS — do not add it again */
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

**A. Supabase CDN script** — in `<head>`, before the closing `</head>` tag:

- [ ] **Step 1: Add Supabase script tag to `<head>`**

Find the closing `</head>` tag and insert before it:

```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.7/dist/umd/supabase.min.js"></script>
```

**B. Auth chip** — inside `.hero-content`, as the last child before its closing tag:

- [ ] **Step 2: Find `.hero-content` and add the auth chip**

Search for `class="hero-content"`. Inside that div, add as the last child:

```html
        <div id="authChip" class="auth-chip" style="display:none" onclick="toggleSignOutDropdown()">
          <div id="authInitial" class="auth-initial"></div>
          <span id="authEmailText" class="auth-email-text"></span>
          <div id="authSignOutDropdown" class="auth-signout-dropdown" style="display:none" onclick="signOut()">Sign out</div>
        </div>
```

**C. Usage indicator** — immediately after the generate button (`id="generateBtn"`):

- [ ] **Step 3: Find the generate button and add usage indicator after it**

Search for `id="generateBtn"`. Immediately after that button's closing tag, add:

```html
      <p id="usageIndicator" class="usage-indicator" style="display:none"></p>
```

**D. Login and paywall modals** — just before the closing `</body>` tag:

- [ ] **Step 4: Add both modals before `</body>`**

```html
  <!-- ── Login modal ── -->
  <div id="loginModal" class="auth-modal-backdrop" style="display:none" onclick="handleLoginBackdropClick(event)">
    <div class="auth-modal-card">
      <div class="auth-modal-icon">🌿</div>
      <h3 class="auth-modal-title">You're on a roll!</h3>
      <p class="auth-modal-subtitle">Save your spot and keep the ideas coming — free account, 30 seconds.</p>
      <button class="auth-btn-primary" onclick="signInWithGoogle()">Continue with Google</button>
      <button class="auth-btn-secondary" onclick="showEmailInput()">Continue with Email</button>
      <div id="emailInputArea" style="display:none">
        <input type="email" id="magicLinkEmail" class="auth-email-input" placeholder="your@email.com">
        <button class="auth-btn-send" onclick="sendMagicLink()">Send magic link →</button>
        <p id="magicLinkSent" class="auth-magic-sent" style="display:none">Check your inbox ✉️</p>
      </div>
      <p class="auth-modal-note">No password needed · Free forever</p>
    </div>
  </div>

  <!-- ── Paywall modal ── -->
  <div id="paywallModal" class="auth-modal-backdrop" style="display:none" onclick="handlePaywallBackdropClick(event)">
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

- [ ] **Step 5: Open in browser, verify no JS console errors on load**

```bash
vercel dev
```

Open http://localhost:3000. Console should be clean (no "supabase is not defined" errors since the CDN script loads synchronously before the inline script).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add auth + paywall HTML to index.html"
```

---

## Chunk 4: index.html — JavaScript

### Task 6: Add auth JS + update generateMeals in index.html

**Files:**
- Modify: `index.html` (JS section inside `<script>` block)

All new JS is added before the closing `</script>` tag, same as the scan functions.

- [ ] **Step 1: Add Supabase init + auth state variables**

Add at the start of the new JS block (after existing code, before `</script>`):

```javascript
    // ── Supabase auth ──────────────────────────────────────────
    // Public keys — safe to hardcode in frontend. Service role key is NEVER here.
    var SUPABASE_URL = 'REPLACE_WITH_YOUR_SUPABASE_URL';
    var SUPABASE_ANON_KEY = 'REPLACE_WITH_YOUR_SUPABASE_ANON_KEY';
    var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    var currentSession = null;
    var currentUsagePlan = 'free';
```

Replace `REPLACE_WITH_YOUR_SUPABASE_URL` and `REPLACE_WITH_YOUR_SUPABASE_ANON_KEY` with the actual values from your Supabase project.

- [ ] **Step 2: Add anonymous counter helpers**

```javascript
    function getAnonCount() {
      return parseInt(localStorage.getItem('plenty_anon_count') || '0', 10);
    }
    function incrementAnonCount() {
      localStorage.setItem('plenty_anon_count', String(getAnonCount() + 1));
    }
    function resetAnonCount() {
      localStorage.removeItem('plenty_anon_count');
    }
```

- [ ] **Step 3: Add auth chip functions**

```javascript
    function renderAuthChip(user) {
      var emailStr = (user && user.email) ? user.email : '';
      var el = document.getElementById('authInitial');
      if (el) el.textContent = emailStr.charAt(0).toUpperCase();
      var emailEl = document.getElementById('authEmailText');
      if (emailEl) emailEl.textContent = emailStr.length > 20 ? emailStr.slice(0, 20) + '\u2026' : emailStr;
      var chip = document.getElementById('authChip');
      if (chip) chip.style.display = 'flex';
    }

    function hideAuthChip() {
      var chip = document.getElementById('authChip');
      if (chip) chip.style.display = 'none';
      var dropdown = document.getElementById('authSignOutDropdown');
      if (dropdown) dropdown.style.display = 'none';
    }

    window.toggleSignOutDropdown = function() {
      var dropdown = document.getElementById('authSignOutDropdown');
      if (!dropdown) return;
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    };
```

- [ ] **Step 4: Add usage indicator functions**

```javascript
    function updateUsageIndicator(count, limit, plan) {
      currentUsagePlan = plan || 'free';
      var el = document.getElementById('usageIndicator');
      if (!el) return;
      if (!currentSession || plan !== 'free') { el.style.display = 'none'; return; }
      el.textContent = count + ' of ' + limit + ' free meal plans used today';
      el.style.display = 'block';
    }

    function hideUsageIndicator() {
      var el = document.getElementById('usageIndicator');
      if (el) el.style.display = 'none';
    }

    async function fetchAndRenderUsage(accessToken) {
      try {
        var res = await fetch('/api/usage', {
          headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        if (res.ok) {
          var data = await res.json();
          updateUsageIndicator(data.count, data.limit, data.plan);
        }
      } catch (e) { /* non-critical — indicator stays hidden */ }
    }
```

- [ ] **Step 5: Add login modal functions**

```javascript
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
      await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
    };

    window.showEmailInput = function() {
      var area = document.getElementById('emailInputArea');
      if (area) area.style.display = 'block';
    };

    window.sendMagicLink = async function() {
      var emailEl = document.getElementById('magicLinkEmail');
      var email = emailEl ? emailEl.value.trim() : '';
      if (!email) return;
      var result = await supabaseClient.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: window.location.origin }
      });
      if (!result.error) {
        var sent = document.getElementById('magicLinkSent');
        if (sent) sent.style.display = 'block';
      }
    };
```

- [ ] **Step 6: Add paywall modal functions**

```javascript
    window.showPaywallModal = function(resetsAt) {
      var modal = document.getElementById('paywallModal');
      if (!modal) return;
      modal.style.display = 'flex';

      // Format prices using browser locale for correct currency symbol
      var locale = navigator.language || 'en-US';
      var currencyMap = { 'en-CA': 'CAD', 'fr-CA': 'CAD', 'en-GB': 'GBP', 'en-AU': 'AUD', 'en-NZ': 'NZD' };
      var currency = currencyMap[locale] || 'USD';
      var fmt = new Intl.NumberFormat(locale, { style: 'currency', currency: currency, minimumFractionDigits: 2 });
      var stdEl = document.getElementById('paywallPriceStandard');
      if (stdEl) stdEl.textContent = fmt.format(4.99) + '/mo';
      var unlEl = document.getElementById('paywallPriceUnlimited');
      if (unlEl) unlEl.textContent = fmt.format(9.99) + '/mo';

      // Show server-authoritative reset time (not client-computed)
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
```

- [ ] **Step 7: Add sign out function**

```javascript
    window.signOut = async function() {
      await supabaseClient.auth.signOut();
      currentSession = null;
      currentUsagePlan = 'free';
      resetAnonCount();
      hideAuthChip();
      hideUsageIndicator();
    };
```

- [ ] **Step 8: Add auth state listener + session restore (must be the last auth JS added)**

```javascript
    // Register auth state change listener FIRST — handles Google OAuth callback + magic link redirect
    supabaseClient.auth.onAuthStateChange(async function(event, session) {
      currentSession = session;
      if (session) {
        renderAuthChip(session.user);
        await fetchAndRenderUsage(session.access_token);
        window.hideLoginModal();
      } else {
        hideAuthChip();
        hideUsageIndicator();
      }
    });

    // Restore persisted session on page load
    supabaseClient.auth.getSession().then(function(result) {
      var session = result && result.data && result.data.session;
      if (session) {
        currentSession = session;
        renderAuthChip(session.user);
        fetchAndRenderUsage(session.access_token);
      }
    });
```

- [ ] **Step 9: Update generateMeals to add auth header, anon gate, and handle new error codes**

Find the `window.generateMeals` function. Make the following targeted changes:

**9a. Add anon gate at the top of the function, before any other logic:**

After `window.generateMeals = async function() {`, insert:

```javascript
    // Gate anonymous users after 2 tries
    if (!currentSession && getAnonCount() >= 2) {
      window.showLoginModal();
      return;
    }
```

**9b. Add Authorization header to the fetch call:**

Find the `fetch('/api/meals', {` call. Change the `headers` object from:
```javascript
headers: { 'Content-Type': 'application/json' },
```
to:
```javascript
headers: Object.assign(
  { 'Content-Type': 'application/json' },
  currentSession ? { 'Authorization': 'Bearer ' + currentSession.access_token } : {}
),
```

**9c. Add 401 and limit_reached handling after `const data = await response.json()`:**

Insert before the existing `if (!response.ok) throw new Error(...)` line:

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
        await supabaseClient.auth.signOut();
        currentSession = null;
        hideAuthChip();
        window.showLoginModal();
        return;
      }
```

**9d. Increment anon counter + update usage indicator on success:**

After the `renderResults(...)` call in the success path, add:

```javascript
      // Track anonymous usage
      if (!currentSession) incrementAnonCount();
      // Update usage indicator for logged-in free users
      if (data.usage) updateUsageIndicator(data.usage.count, data.usage.limit, currentUsagePlan);
```

- [ ] **Step 10: Verify in browser**

```bash
vercel dev
```

Open http://localhost:3000 — browser DevTools console must be clean (no "supabase is not defined", no TypeError, no syntax errors). Note: at this stage Google OAuth requires a deployed URL; magic link works on localhost.

- [ ] **Step 11: Commit**

```bash
git add index.html
git commit -m "feat: add auth JS + update generateMeals for Supabase auth + usage"
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

1. Open browser DevTools → Application → Local Storage → clear `plenty_anon_count`
2. Add 2 ingredients → Generate meals twice → both should succeed
3. Try to generate a 3rd time → login modal should appear with 🌿 icon, Google button, Email button
4. Click backdrop → modal closes, form still accessible
5. Try Generate again → login modal should re-appear

Expected: ✅ modal appears on 3rd anonymous attempt

- [ ] **Step 3: Test email magic link flow**

1. In the login modal, click "Continue with Email"
2. Email input area should appear
3. Enter a real email address → click "Send magic link"
4. Should see "Check your inbox ✉️" message
5. Check the email inbox — click the magic link
6. Should redirect back to the app with session active
7. Auth chip should appear top-right with your initial + email
8. Usage indicator should appear below generate button: "0 of 2 free meal plans used today"

Expected: ✅ auth chip visible, usage indicator shows 0 of 2

- [ ] **Step 4: Test usage tracking**

1. While logged in, generate 2 meals
2. After each generation, usage indicator should increment: "1 of 2...", then "2 of 2..."
3. Generate a 3rd time → paywall modal should appear with plan pricing in correct currency (CAD for Canadian locale)
4. Paywall modal should show the reset time from the server
5. Click backdrop → modal closes

Expected: ✅ paywall appears on 3rd logged-in generation

- [ ] **Step 5: Test sign out**

1. Click the auth chip → "Sign out" dropdown appears
2. Click "Sign out"
3. Auth chip hides, usage indicator hides
4. `plenty_anon_count` should be reset to 0 (check DevTools → Local Storage)

Expected: ✅ clean sign-out state

- [ ] **Step 6: Test Google OAuth (production only — requires deployed URL)**

Push branch to GitHub and wait for Vercel preview deploy:

```bash
git push -u origin supabase-auth
```

Open the preview URL. Test Google sign-in — should redirect through Google and return to the app with session active.

- [ ] **Step 7: Verify backend file syntax**

```bash
node --check api/usage.js && node --check api/meals.js && echo "✅ all clear"
```

Expected: `✅ all clear` (Note: `node --check` works correctly on `.js` files; do not run it on `index.html`)

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
