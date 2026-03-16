# PlentyMeals — AI Meal Suggestion App
> "You already have everything you need to eat well tonight."

## What it does
PlentyMeals takes whatever ingredients you have and suggests 3 complete meals you can make right now. The tone is empowering and abundant — never making users feel like they "only" have a few things. Built for people experiencing food cost pressure or psychological scarcity around food.

---

## Repo structure
```
/
├── index.html                ← entire frontend (single file)
├── vercel.json               ← Vercel routing + function config
├── privacy.html              ← Privacy Policy page
├── terms.html                ← Terms of Use page
├── logo.svg                  ← horizontal logo lockup (230×56, for headers/docs)
├── logo-icon.svg             ← square icon only (56×56, for favicons/app icons)
├── README.md                 ← this file
├── CLAUDE.md                 ← AI assistant context for this codebase
├── docs/
│   └── superpowers/
│       ├── specs/            ← design specs
│       └── plans/            ← implementation plans
└── api/
    ├── meals.js              ← Anthropic API proxy (main AI route)
    ├── usage.js              ← usage tracking: checkAndIncrementUsage + GET /api/usage
    ├── scan.js               ← Claude Haiku vision: photo → ingredient list
    ├── subscribe.js          ← email capture → Google Sheets
    └── photo.js              ← unused (gradient placeholders used instead)
```

---

## Tech stack
| Layer | Tool |
|---|---|
| Frontend | Vanilla HTML/CSS/JS (single file) |
| Backend | Vercel serverless functions |
| AI | Claude Haiku (`claude-haiku-4-5-20251001`) |
| Auth & database | Firebase (Google OAuth + email magic link + Firestore usage tracking) |
| Feedback & email capture | Google Apps Script → Google Sheet |
| Hosting | Vercel (free tier, auto-deploy from GitHub) |

---

## Environment variables (set in Vercel dashboard)
| Variable | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | `api/meals.js` |
| `FIREBASE_PROJECT_ID` | `api/usage.js` — server-side only |
| `FIREBASE_CLIENT_EMAIL` | `api/usage.js` — server-side only (service account) |
| `FIREBASE_PRIVATE_KEY` | `api/usage.js` — **secret, server-side only, never in `index.html`** |
| `UNSPLASH_KEY` | Not currently used |
| `PEXELS_KEY` | Not currently used |

> **Vercel env var formatting gotcha:** When adding `FIREBASE_PRIVATE_KEY` via Vercel CLI, use `printf '%s'` (not `echo`) to avoid a trailing newline corrupting the key. The private key literal `\n` sequences must be converted to real newlines — pipe through `python3 -c "import sys; print(sys.stdin.read().replace('\\\\n', '\\n'), end='')"` before passing to `vercel env add`.

---

## Google Sheet structure
Two tabs auto-created by the Apps Script:
- **Subscribers** — Timestamp, Email, Source
- **Feedback** — Timestamp, Vote (yes/no), Message, Email, Source

---

## Features (current — v4)
- **Ingredient photo scan** — tap 📷 to photograph a fridge or countertop; Claude Haiku vision identifies ingredients and presents a pre-ticked confirmation panel to merge into the list
- **Ingredient input** — type naturally ("2 eggs", "500g chicken", "rice") or use quick-add staple buttons
- **Diet & skill profile** — diet preference, cooking skill level, servings
- **Health conditions** — 8 selectable conditions (Diabetes, High Cholesterol, High Blood Pressure, Heart Disease, Kidney Disease, IBS, Weight Management, Anaemia) with tailored meal rules and "Why this is good for you" insights
- **3 meal suggestions** — name, affirmation quote, description, time, difficulty, ingredient quantities, nutrition, cooking steps
- **Cuisine selector** — 13 options from broad (Any, African, Asian) to specific (West African, East Asian, Caribbean, etc.); passed to the AI prompt to narrow suggestions; honest adaptation naming when ingredients don't naturally fit
- **Login + usage limits** — Google OAuth + email magic link (no password); 2 free generations/day for logged-in users; anonymous users get 2 lifetime tries (localStorage, no reset) before a persistent sign-in gate replaces the generate button; paywall modal on daily limit hit; usage counter shown below generate button for both anonymous and logged-in users
- **Firebase App Check** — reCAPTCHA v3 enforced on Auth + Firestore; blocks bots and scripts from abusing Firebase services; API key restricted by HTTP referrer in GCP Console
- **Site nav bar** — PlentyMeals logo (left) + avatar/Sign-in button (right) inside the hero; avatar shows first initial only; Sign In pill appears after sign-out
- **Triadic colour meal headers** — 3 cards use colour-wheel triadic harmony (terracotta→gold, forest→sage green, plum→terracotta) with frosted-glass emoji box
- **Staggered spring reveal** — 5-stage animation choreography per card (cardReveal → headerReveal → emojiPop → affirmSlide → chipCascade)
- **Aurora loading state** — ambient colour blobs + dual concentric rings + shimmer skeleton cards replace the old spinner
- **Focus mode results** — form hides on results display; only hero + meals shown. "← Try different ingredients" restores the form
- **Stretch meal** — one extra cheap ingredient that unlocks a 4th meal idea
- **Rate a meal** — 👍 / 👎 per meal; ratings influence next generation
- **Share a meal** — WhatsApp, Facebook, download image (html2canvas), copy text; share image includes PlentyMeals branding and URL
- **Share PlentyMeals nudge** — WhatsApp card at bottom of results to share the app with friends
- **Feedback card** — 👍 / 👎 after results with optional text box; if user hasn't subscribed, email prompt appears inline; all saved to Google Sheet Feedback tab
- **Email capture** — separate signup card → Google Sheet Subscribers tab; duplicate-safe
- **Privacy Policy & Terms of Use** — linked in footer, served as static HTML pages
- **Logo files** — `logo.svg` (horizontal lockup) and `logo-icon.svg` (square icon) in repo root; terracotta circle, green leaf, Playfair Display wordmark

---

## Known architecture decisions
- **No Unsplash/Pexels photos** — gradient placeholders used instead (real food APIs returned irrelevant images for African/diverse dishes)
- **All onclick handlers exposed as `window.X`** — required because functions are defined inside a script block, not globally. Always add `window.X =` for any new function called via onclick
- **meals.js cleans control characters with charCodeAt()** — regex with literal newlines in the file was corrupting Vercel compilation silently
- **sanitizeString allowlist includes JSON schema chars** — `{`, `}`, `[`, `]`, `"` must be allowed or the JSON schema in the AI prompt gets stripped, causing Claude to return plain strings instead of arrays
- **scan.js uses content array not string** — Claude vision API requires `content: [imageBlock, textBlock]`; unlike meals.js which passes `content` as a plain string
- **Canvas resizeImage strips data-URI prefix** — `canvas.toDataURL('image/jpeg').split(',')[1]`; the Claude API needs raw base64, not the `data:image/jpeg;base64,...` prefix
- **claude-haiku not claude-sonnet** — faster, cheaper, avoids timeout on Vercel free tier
- **max_tokens: 1800** — increased from 1200 to handle health condition prompts without truncation; passed from frontend so meals.js stays flexible
- **Feedback goes direct to Sheets URL** — no Vercel function needed, frontend calls Google Apps Script directly with query params
- **Anonymous counter helpers in non-module script** — `getAnonCount`, `incrementAnonCount`, `resetAnonCount` are defined in the plain `<script>` block (not `<script type="module">`). Firebase CDN ES module imports are deferred; if a user clicks "Generate" before the CDN resolves, functions defined inside the module block are `undefined`. Since the anon counter only needs `localStorage`, it has zero Firebase dependency and belongs in the synchronous script.
- **`authDomain` must be the Firebase Hosting domain** — set to `plenty-meals.firebaseapp.com`, not the Vercel domain. Firebase sends email magic links to `{authDomain}/__/auth/action?...`; only Firebase Hosting can serve that route. Setting `authDomain` to a Vercel URL causes magic links to silently fail (page loads but sign-in never completes).
- **`verifyIdToken` vs Firestore auth use different keys** — `verifyIdToken` uses Firebase's public key (works even if `FIREBASE_PRIVATE_KEY` is malformed). Firestore outbound calls generate OAuth2 tokens signed with the service account private key — a bad key gives `16 UNAUTHENTICATED`. Both need the key correct; Firestore failures are the earlier signal.
- **Trailing comma stripping before JSON.parse in meals.js** — Claude occasionally emits `["item",]` (trailing comma before closing bracket). This is invalid JSON and throws "Unexpected comma" in Safari. Stripped with `/,(\s*[}\]])/g` after control character cleaning, before `JSON.parse`.
- **Anonymous limit is permanent (no 24h reset)** — intentional design decision to push signups. Anonymous users get 2 lifetime tries on a device; reset only happens on sign-in/sign-out.

---

## Deployment
1. Push to GitHub (`plenty-app` repo)
2. Vercel auto-deploys on every push
3. Live at: `plenty-app-nine.vercel.app`

---

## Resume prompt (copy this into a new Claude Code session)

```
We're working on the PlentyMeals app — an AI meal suggestion app at plenty-app-nine.vercel.app.

Read CLAUDE.md before doing anything. Here's where we are:

DONE (all shipped to main / production):
- Full app UI (index.html — single file, no build step)
- Claude Haiku meal generation via /api/meals.js
- Fridge photo scan via /api/scan.js (Claude vision)
- Firebase Auth: Google OAuth + email magic link login (no password)
- Usage limits: 2 free generations/day (Firestore), anonymous gate (localStorage, 2 lifetime tries, no reset)
- Persistent sign-in gate (replaces generate button when anon limit hit)
- Anon counter display below generate button
- Paywall modal on daily limit hit
- Google Search Console verification file added
- Rebrand: app name is PlentyMeals everywhere
- Site nav bar: logo left, avatar/Sign-in button right
- Logo files: logo.svg + logo-icon.svg in repo root
- Firebase App Check: reCAPTCHA v3 enforced on Auth + Firestore
- API key restricted by HTTP referrer in GCP Console

NEXT UP (pick one):
1. Stripe payments — wire up the existing paywall modal to Stripe Checkout for Standard ($4.99/mo CAD) and Unlimited ($9.99/mo CAD) tiers. Firebase Firestore `profiles` collection already has a `plan` field ready.
2. Apple Sign In — required before iOS App Store submission (Apple rule: must offer Apple Sign In if any third-party OAuth offered). Firebase Auth supports it.
3. Save favourite meals — logged-in users can bookmark a meal; saved to Firestore under their uid.
4. Shopping list generator — tap a meal to get a formatted shopping list of missing ingredients.

Tech stack: Vanilla HTML/CSS/JS (index.html), Vercel serverless functions (/api/*.js), Firebase Auth + Firestore, Claude Haiku (claude-haiku-4-5-20251001), Google Sheets for feedback/email capture.

All env vars are in Vercel dashboard and .env.local. Use `vercel dev` to test locally.
```

---

## Roadmap
### Next (Round 1 — get paying users)
- [x] Cuisine choice selector
- [x] Login + usage limits (Google OAuth + email magic link; 2 free/day; paywall modal)
- [x] Rebrand to PlentyMeals
- [x] Site nav bar with avatar + Sign In button
- [x] Persistent sign-in gate for anonymous limit
- [ ] Stripe payments
- [ ] Apple Sign In ← **required before App Store submission**
- [ ] First TikTok/Instagram content video

### Round 2 — wow factor
- [x] Fridge photo scan
- [ ] Save favourite meals
- [ ] Shopping list generator

### Round 3 — scale
- [ ] iOS App Store + Google Play Store
- [ ] Weekly meal planner
- [ ] Language selector
- [ ] Welcome email sequence
