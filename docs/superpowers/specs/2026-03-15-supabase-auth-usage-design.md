# Supabase Auth + Usage Tracking — Design Spec

**Date:** 2026-03-15
**Feature:** User login (Google + email magic link) + daily generation limit enforcement
**Status:** Approved for implementation
**Phase:** 1 of 2 (Phase 2 = Stripe payments)

---

## Goal

Allow Plenty to know who its users are and enforce a daily generation limit. Anonymous users get 2 free generations lifetime before being prompted to log in. Logged-in free users get 2 generations per day. Paid tiers (enforced in Phase 2) get 15/day or unlimited.

---

## Architecture

### New files
- `api/usage.js` — Vercel serverless function AND shared utility module. Exports a `checkAndIncrementUsage(accessToken)` function used directly by `api/meals.js` (imported as a module, not called via HTTP — avoids extra latency and billable invocations). Also exposes a GET endpoint for the frontend to fetch current usage count after login.

### Modified files
- `index.html` — Supabase JS client (CDN, pinned version), auth state management, login modal, paywall modal, auth chip, usage indicator
- `api/meals.js` — imports `checkAndIncrementUsage` from `api/usage.js`; adds `Authorization` to `Access-Control-Allow-Headers`; returns `{ count, limit }` alongside meal data on success; returns `HTTP 401` for invalid/expired token, `HTTP 429` with `{ error: "limit_reached", resets_at: "..." }` for usage limit

### New Supabase resources
- **Auth providers:** Google OAuth + email magic link (configured in Supabase dashboard)
- **Table: `usage`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | primary key, auto |
| `user_id` | uuid | references `auth.users.id` |
| `date` | date | UTC date of usage |
| `count` | integer | generations used on this date, default 0 |

Unique constraint on `(user_id, date)` — one row per user per day.

- **Table: `profiles`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | primary key, references `auth.users.id` |
| `plan` | text | `free` / `standard` / `unlimited`, default `free` |
| `created_at` | timestamptz | auto |

Row auto-created on first sign-up via Supabase auth trigger. `plan` is updated by Stripe webhook in Phase 2. Usage limit is looked up from `profiles.plan`, not from the `usage` table — this ensures a plan change takes effect immediately without touching historical rows.

Row-level security on both tables: users can only read their own rows. `api/usage.js` uses the **service role key** (server-side only, never sent to the browser) to bypass RLS for trusted writes.

### Environment variables (Vercel dashboard)
- `SUPABASE_URL` — project URL (hardcoded as a string literal in `index.html` — it is a public value, safe to expose)
- `SUPABASE_ANON_KEY` — public anon key (also hardcoded in `index.html` — safe to expose)
- `SUPABASE_SERVICE_ROLE_KEY` — secret, server-side only, used in `api/usage.js`; never sent to the browser

### No new npm packages
Supabase JS loaded from CDN in `index.html` at a pinned version:
```
https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.7/dist/umd/supabase.min.js
```

---

## Branching

All work done on branch `supabase-auth`. Merged to `main` only when complete and tested.

---

## User Flows

### Anonymous user
1. Opens app — no login required
2. Generates meals — count stored in `localStorage` key `plenty_anon_count` (integer, 0–2)
3. After 2nd generation, login modal slides up over results
4. User signs in with Google or email magic link
5. Supabase returns session; Supabase JS automatically persists tokens in `localStorage` and refreshes silently
6. Anonymous count discarded — logged-in daily limit starts fresh from the database

**Known limitation:** `plenty_anon_count` is client-side only and can be reset via DevTools. This is a deliberate product tradeoff — the anonymous limit exists to nudge sign-up, not as a hard security gate. The real limit enforcement happens server-side once the user is authenticated.

### Logged-in free user
1. App loads — `supabase.auth.getSession()` called once to restore session; `supabase.auth.onAuthStateChange()` listener handles Google OAuth callback fragment and magic link click (both arrive as URL hash on redirect back to the app)
2. Auth chip appears in hero (user's email initial + truncated email)
3. Generate button clicked → frontend POSTs to `/api/meals` with `Authorization: Bearer <access_token>` header
4. `api/meals.js` calls `checkAndIncrementUsage(accessToken)`:
   a. Validates token via `supabase.auth.getUser(accessToken)` using the service role client (correct Supabase server-side pattern — respects token revocation)
   b. If token invalid or expired: returns `{ error: 'unauthorized' }` — caller returns `HTTP 401`
   c. Looks up `profiles.plan` for this user
   d. Determines limit: `free` → 2, `standard` → 15, `unlimited` → Infinity
   e. Atomically upserts today's UTC usage row: `INSERT INTO usage (user_id, date, count) VALUES (?, today, 1) ON CONFLICT (user_id, date) DO UPDATE SET count = usage.count + 1 WHERE usage.count < limit RETURNING count` — the `WHERE usage.count < limit` condition in the upsert prevents race conditions; if the condition fails (count already at limit), the row is not updated and the query returns 0 rows
   f. If upsert returned 0 rows (limit already reached): returns `{ error: 'limit_reached' }` — caller returns `HTTP 429`
   g. If upsert succeeded: returns `{ count: <new_count>, limit: <limit> }`
5. On success: `api/meals.js` includes `{ count, limit }` in response alongside meal data. Frontend updates usage indicator.
6. On `HTTP 429` with `error: 'limit_reached'`: frontend shows paywall modal
7. On `HTTP 401`: frontend clears session (`supabase.auth.signOut()`), shows login modal

### 429 disambiguation
Both the IP rate limiter and the usage limit return `HTTP 429`. The frontend distinguishes them by checking `data.error`:
- `data.error === 'limit_reached'` → show paywall modal
- Any other 429 → show generic "Too many requests" error message (existing behaviour)

### Logged-in paid user (plan column ready, limit enforced in Phase 2 via `profiles.plan`)
Same flow — limit is automatically 15 or Infinity once Phase 2 updates `profiles.plan` via Stripe webhook.

### Sign out
- Tap auth chip → "Sign out" → `supabase.auth.signOut()` → clears Supabase tokens from localStorage → `plenty_anon_count` reset to 0 → auth chip hidden → usage indicator hidden
- Any in-flight generation request that completes after sign-out: response is ignored (the UI will have already reset)

---

## UI Components

### Auth chip
- Position: top-right of `.hero-content`, appears only when session active
- Shows user's email initial in a terracotta circle + truncated email (max 20 chars)
- On click: shows inline "Sign out" link below chip
- On sign-out click: calls `supabase.auth.signOut()`, hides chip

### Login modal
- Triggered: `plenty_anon_count` reaches 2 and user clicks Generate again
- Style: warm overlay — semi-transparent dark backdrop + centred card, `--warm-white` background, `border-radius: 20px`, `--shadow-card`, slides up with CSS transition
- Content:
  - 🌿 icon
  - "You're on a roll!" heading
  - "Save your spot and keep the ideas coming — free account, 30 seconds."
  - "Continue with Google" button — calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`
  - "Continue with Email" button — reveals inline email input + "Send magic link" button; on submit calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })`; on success shows "Check your inbox ✉️" message
  - "No password needed · Free forever" in muted text
- Dismiss: clicking backdrop closes modal (user can browse results); next Generate click re-triggers if still not logged in
- The Supabase dashboard **Redirect URLs allowlist** must include both `http://localhost:3000` and `https://plenty-app-nine.vercel.app`

### Paywall modal
- Triggered: `api/meals.js` returns `HTTP 429` with `error: 'limit_reached'`
- Same overlay style as login modal
- Content:
  - 🌿 icon
  - "You're eating well today!" heading
  - "You've used your 2 free meal plans. Upgrade for more — or come back tomorrow."
  - Two plan cards side by side, prices formatted with `Intl.NumberFormat(navigator.language, { style: 'currency', currency: localeCurrency })` where `localeCurrency` is inferred from locale (`en-CA` → CAD, `en-US` → USD, `en-GB` → GBP, default USD):
    - Standard: "4.99/month · 15 meal plans/day" — button disabled, label "Coming soon"
    - Unlimited: "9.99/month · Unlimited" — button disabled, label "Coming soon"
  - Footer: "Or wait until midnight — your free 2 reset daily"
  - Reset time displayed to user is taken from the `resets_at` field in the HTTP 429 response body (server-authoritative UTC midnight tomorrow), formatted to local time via `new Date(resets_at).toLocaleTimeString(navigator.language, { hour: '2-digit', minute: '2-digit' })`. The client does not recompute this value independently.
- Dismiss: backdrop click closes modal

### Usage indicator
- Position: below the Generate button
- Visible only to logged-in free users (`profiles.plan === 'free'`)
- Text: "X of 2 free meal plans used today" — X comes from the `count` field in the most recent `/api/meals` success response (or from a GET to `/api/usage` on app load after login)
- Hidden for paid users (`plan !== 'free'`) and anonymous users

---

## API changes

### `api/meals.js` changes
1. Add `'Authorization'` to `Access-Control-Allow-Headers`
2. If `Authorization` header present: extract token, call `checkAndIncrementUsage(token)`
   - If `{ error: 'unauthorized' }`: return `HTTP 401 { error: 'Session expired. Please log in again.' }`
   - If `{ error: 'limit_reached' }`: return `HTTP 429 { error: 'limit_reached', resets_at: '<ISO UTC midnight tomorrow>' }`
   - If success `{ count, limit }`: proceed with meal generation; include `{ ..., usage: { count, limit } }` in response
3. If no `Authorization` header: proceed with generation (anonymous user — client enforces the 2-try limit)

### `api/usage.js` exports
- `checkAndIncrementUsage(accessToken)` — async function used by `api/meals.js`
- GET `/api/usage` — returns `{ count, limit, plan }` for the authenticated user (used by frontend on load to populate usage indicator)

---

## Session handling on page load
```
1. supabase.auth.onAuthStateChange(handler) — registered first, handles OAuth/magic link callbacks
2. supabase.auth.getSession() — restores persisted session
3. If session: fetch GET /api/usage to get current count → show auth chip + usage indicator
4. If no session: show app in anonymous mode
```

---

## Error handling summary

| Scenario | Server response | Frontend action |
|----------|----------------|-----------------|
| Token invalid/expired | HTTP 401 | Clear session, show login modal |
| Usage limit reached | HTTP 429 `limit_reached` | Show paywall modal |
| IP rate limit hit | HTTP 429 (other error) | Show generic error toast |
| Supabase auth unreachable (`getUser` throws) | HTTP 503 | Show generic error, do not treat as authenticated |
| Usage table write fails (after successful auth) | — | Fail open: allow generation, log error server-side |
| Email magic link sent | — | Show "Check your inbox ✉️" inline |

---

## Out of scope (Phase 2)
- Stripe checkout and subscription management
- Webhook to update `profiles.plan` on subscription events
- Email receipts or invoices
- Account management page
- Admin dashboard

---

## Constraints
- No new npm packages (Supabase loaded from CDN at pinned version)
- Vercel free tier compatible
- Works on iOS Safari, Android Chrome, desktop browsers
- `SUPABASE_SERVICE_ROLE_KEY` never sent to browser
- `plenty_anon_count` reset limit is intentionally client-side (deliberate product tradeoff)
