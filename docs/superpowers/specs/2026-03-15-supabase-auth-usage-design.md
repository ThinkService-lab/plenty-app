# Auth + Usage Tracking — Design Spec

**Date:** 2026-03-15 (updated to Firebase 2026-03-15)
**Feature:** User login (Google + email magic link) + daily generation limit enforcement
**Status:** Approved for implementation
**Phase:** 1 of 2 (Phase 2 = Stripe payments)
**Backend:** Firebase (Auth + Firestore) — originally designed for Supabase, migrated to Firebase due to free tier availability

---

## Goal

Allow Plenty to know who its users are and enforce a daily generation limit. Anonymous users get 2 free generations lifetime before being prompted to log in. Logged-in free users get 2 generations per day. Paid tiers (enforced in Phase 2) get 15/day or unlimited.

---

## Architecture

### New files
- `api/usage.js` — Vercel serverless function AND shared utility module. Exports a `checkAndIncrementUsage(idToken)` function used directly by `api/meals.js` (imported as a module, not called via HTTP — avoids extra latency and billable invocations). Also exposes a GET endpoint for the frontend to fetch current usage count after login.
- `package.json` — adds `firebase-admin` as the only npm dependency (needed for server-side token verification and Firestore atomic transactions)

### Modified files
- `index.html` — Firebase JS client (CDN, pinned version), auth state management, login modal, paywall modal, auth chip, usage indicator
- `api/meals.js` — imports `checkAndIncrementUsage` from `api/usage.js`; adds `Authorization` to `Access-Control-Allow-Headers`; returns `{ count, limit }` alongside meal data on success; returns `HTTP 401` for invalid/expired token, `HTTP 429` with `{ error: "limit_reached", resets_at: "..." }` for usage limit

### Firebase resources
- **Auth providers:** Google OAuth + email link / passwordless (configured in Firebase Console)
- **Firestore collection: `profiles`**
  - Document ID: `{uid}`
  - Fields: `plan` (string: `free` / `standard` / `unlimited`, default `free`), `createdAt` (timestamp)
  - Auto-created on first sign-in via a `profiles/{uid}` upsert in `checkAndIncrementUsage` (server-side, first time only)

- **Firestore collection: `usage`**
  - Document ID: `{uid}_{YYYY-MM-DD}` (e.g. `abc123_2026-03-15`)
  - Fields: `userId` (string), `date` (string), `count` (integer)
  - One document per user per UTC day

Firestore security rules: users can only read their own documents. Server-side (`api/usage.js`) uses the **Firebase Admin SDK** which bypasses security rules entirely (trusted server context).

### Environment variables (Vercel dashboard + `.env.local`)

**Server-side only (never sent to browser):**
- `FIREBASE_PROJECT_ID` — Firebase project ID
- `FIREBASE_CLIENT_EMAIL` — service account email
- `FIREBASE_PRIVATE_KEY` — service account private key (include the full PEM including `\n` newlines)

**Public (safe to hardcode in `index.html`):**
- Firebase web app config object: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`

### npm dependency
`firebase-admin` added to `package.json`. This is the only npm dependency. Vercel installs it automatically on deploy.

### Frontend Firebase JS SDK
Loaded from Google CDN at pinned version (no npm, no bundler):
```html
<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
  import { getAuth, GoogleAuthProvider, signInWithPopup,
           sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
           onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
  // ... assign to window globals for use in onclick handlers
</script>
```

**Note:** Firebase JS SDK v10 uses ES module imports. The script tag must be `type="module"`. All functions needed by `onclick` handlers must be explicitly assigned to `window.*` inside this module script.

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
5. Firebase returns ID token; Firebase JS SDK automatically persists tokens in `localStorage` and refreshes silently
6. Anonymous count discarded — logged-in daily limit starts fresh from the database

**Known limitation:** `plenty_anon_count` is client-side only and can be reset via DevTools. This is a deliberate product tradeoff — the anonymous limit exists to nudge sign-up, not as a hard security gate. The real limit enforcement happens server-side once the user is authenticated.

### Logged-in free user
1. App loads — `onAuthStateChanged(auth, handler)` registered first to handle redirect callbacks; `auth.currentUser` checked to restore existing session
2. Auth chip appears in hero (user's email initial + truncated email)
3. Generate button clicked → frontend POSTs to `/api/meals` with `Authorization: Bearer <idToken>` header (Firebase ID token, refreshed via `user.getIdToken()`)
4. `api/meals.js` calls `checkAndIncrementUsage(idToken)`:
   a. Verifies token via `admin.auth().verifyIdToken(idToken)` — throws if invalid/expired
   b. If token invalid or expired: returns `{ error: 'unauthorized' }` — caller returns `HTTP 401`
   c. Reads `profiles/{uid}` from Firestore to get `plan`; if doc doesn't exist, creates it with `plan: 'free'`
   d. Determines limit: `free` → 2, `standard` → 15, `unlimited` → Infinity
   e. Atomically increments today's usage via Firestore transaction:
      - Reads `usage/{uid}_{today}` document
      - If `count >= limit`: returns `{ limited: true, count }`
      - Else: writes `count + 1` (or creates doc with `count: 1`)
   f. If limited: returns `{ error: 'limit_reached' }` — caller returns `HTTP 429`
   g. If success: returns `{ count: <new_count>, limit: <limit>, plan }`
5. On success: `api/meals.js` includes `{ count, limit }` in response alongside meal data. Frontend updates usage indicator.
6. On `HTTP 429` with `error: 'limit_reached'`: frontend shows paywall modal
7. On `HTTP 401`: frontend calls `auth.signOut()`, shows login modal

### Email magic link flow
Firebase calls this "email link authentication":
1. User enters email → frontend calls `sendSignInLinkToEmail(auth, email, actionCodeSettings)` where `actionCodeSettings.url = window.location.origin`
2. Firebase emails a sign-in link
3. User clicks link → lands back at the app URL with `?apiKey=...&oobCode=...` query params
4. On page load: `isSignInWithEmailLink(auth, window.location.href)` detects the link
5. Call `signInWithEmailLink(auth, email, window.location.href)` — email retrieved from `localStorage` key `plenty_email_for_signin`
6. `onAuthStateChanged` fires with the new user

### 429 disambiguation
Both the IP rate limiter and the usage limit return `HTTP 429`. The frontend distinguishes them by checking `data.error`:
- `data.error === 'limit_reached'` → show paywall modal
- Any other 429 → show generic "Too many requests" error message (existing behaviour)

### Logged-in paid user (plan field ready, limit enforced in Phase 2 via `profiles/{uid}.plan`)
Same flow — limit is automatically 15 or Infinity once Phase 2 updates `profiles/{uid}.plan` via Stripe webhook.

### Sign out
- Tap auth chip → "Sign out" → `auth.signOut()` → Firebase clears tokens → `plenty_anon_count` reset to 0 → auth chip hidden → usage indicator hidden

---

## UI Components

### Auth chip
- Position: top-right of `.hero-content`, appears only when session active
- Shows user's email initial in a terracotta circle + truncated email (max 20 chars)
- On click: shows inline "Sign out" link below chip
- On sign-out click: calls `auth.signOut()`, hides chip

### Login modal
- Triggered: `plenty_anon_count` reaches 2 and user clicks Generate again
- Style: warm overlay — semi-transparent dark backdrop + centred card, `--warm-white` background, `border-radius: 20px`, `--shadow-card`, slides up with CSS transition
- Content:
  - 🌿 icon
  - "You're on a roll!" heading
  - "Save your spot and keep the ideas coming — free account, 30 seconds."
  - "Continue with Google" button — calls `signInWithPopup(auth, googleProvider)`
  - "Continue with Email" button — reveals inline email input + "Send magic link" button; on submit calls `sendSignInLinkToEmail`; saves email to `localStorage` key `plenty_email_for_signin`; on success shows "Check your inbox ✉️" message
  - "No password needed · Free forever" in muted text
- Dismiss: clicking backdrop closes modal (user can browse results); next Generate click re-triggers if still not logged in
- Firebase Console → Authentication → Settings → **Authorized domains** must include both `localhost` and `plenty-app-nine.vercel.app`

### Paywall modal
- Triggered: `api/meals.js` returns `HTTP 429` with `error: 'limit_reached'`
- Same overlay style as login modal
- Content:
  - 🌿 icon
  - "You're eating well today!" heading
  - "You've used your 2 free meal plans. Upgrade for more — or come back tomorrow."
  - Two plan cards side by side, prices formatted with `Intl.NumberFormat(navigator.language, { style: 'currency', currency: localeCurrency })` where `localeCurrency` is inferred from locale (`en-CA` → CAD, `fr-CA` → CAD, `en-GB` → GBP, `en-AU` → AUD, `en-NZ` → NZD, default USD):
    - Standard: "4.99/month · 15 meal plans/day" — button disabled, label "Coming soon"
    - Unlimited: "9.99/month · Unlimited" — button disabled, label "Coming soon"
  - Footer reset time: taken from the `resets_at` field in the HTTP 429 response body (server-authoritative UTC midnight tomorrow), formatted to local time via `new Date(resets_at).toLocaleTimeString(navigator.language, { hour: '2-digit', minute: '2-digit' })`. The client does not recompute this value independently.
- Dismiss: backdrop click closes modal

### Usage indicator
- Position: below the Generate button
- Visible only to logged-in free users (`plan === 'free'`)
- Text: "X of 2 free meal plans used today" — X comes from the `count` field in the most recent `/api/meals` success response (or from a GET to `/api/usage` on app load after login)
- Hidden for paid users and anonymous users

---

## API changes

### `api/meals.js` changes
1. Add `'Authorization'` to `Access-Control-Allow-Headers`
2. If `Authorization` header present: extract token, call `checkAndIncrementUsage(token)`
   - If `{ error: 'unauthorized' }`: return `HTTP 401 { error: 'Session expired. Please log in again.' }`
   - If `{ error: 'service_unavailable' }`: return `HTTP 503 { error: 'Service temporarily unavailable. Please try again.' }`
   - If `{ error: 'limit_reached' }`: return `HTTP 429 { error: 'limit_reached', resets_at: '<ISO UTC midnight tomorrow>' }`
   - If success `{ count, limit }`: proceed with meal generation; include `{ ..., usage: { count, limit } }` in response
3. If no `Authorization` header: proceed with generation (anonymous user — client enforces the 2-try limit)

### `api/usage.js` exports
- `checkAndIncrementUsage(idToken)` — async function used by `api/meals.js`
- GET `/api/usage` — returns `{ count, limit, plan }` for the authenticated user (used by frontend on load to populate usage indicator)

---

## Session handling on page load
```
1. isSignInWithEmailLink check — if URL contains email link params, complete sign-in first
2. onAuthStateChanged(auth, handler) — registered to handle auth state (including email link completion)
3. If session active on load: fetch GET /api/usage → show auth chip + usage indicator
4. If no session: show app in anonymous mode
```

---

## Error handling summary

| Scenario | Server response | Frontend action |
|----------|----------------|-----------------|
| Token invalid/expired | HTTP 401 | Clear session, show login modal |
| Usage limit reached | HTTP 429 `limit_reached` | Show paywall modal |
| IP rate limit hit | HTTP 429 (other error) | Show generic error toast |
| Firebase auth unreachable (`verifyIdToken` throws) | HTTP 503 | Show generic error, do not treat as authenticated |
| Usage Firestore write fails (after successful auth) | — | Fail open: allow generation, log error server-side |
| Email magic link sent | — | Show "Check your inbox ✉️" inline |

---

## Out of scope (Phase 2)
- Stripe checkout and subscription management
- Webhook to update `profiles/{uid}.plan` on subscription events
- Email receipts or invoices
- Account management page
- Admin dashboard

---

## Constraints
- `firebase-admin` is the only npm dependency added
- Frontend Firebase JS SDK loaded from Google CDN at pinned version (no bundler)
- Vercel free tier compatible
- Works on iOS Safari, Android Chrome, desktop browsers
- Firebase service account private key (`FIREBASE_PRIVATE_KEY`) never sent to browser
- `plenty_anon_count` reset limit is intentionally client-side (deliberate product tradeoff)
