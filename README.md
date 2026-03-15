# Plenty — AI Meal Suggestion App
> "You already have everything you need to eat well tonight."

## What it does
Plenty takes whatever ingredients you have and suggests 3 complete meals you can make right now. The tone is empowering and abundant — never making users feel like they "only" have a few things. Built for people experiencing food cost pressure or psychological scarcity around food.

---

## Repo structure
```
/
├── index.html                ← entire frontend (single file)
├── vercel.json               ← Vercel routing + function config
├── privacy.html              ← Privacy Policy page
├── terms.html                ← Terms of Use page
├── README.md                 ← this file
├── CLAUDE.md                 ← AI assistant context for this codebase
├── docs/
│   └── superpowers/
│       ├── specs/            ← design specs
│       └── plans/            ← implementation plans
└── api/
    ├── meals.js              ← Anthropic API proxy (main AI route)
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
| Feedback & email capture | Google Apps Script → Google Sheet |
| Hosting | Vercel (free tier, auto-deploy from GitHub) |

---

## Environment variables (set in Vercel dashboard)
| Variable | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | `api/meals.js` |
| `UNSPLASH_KEY` | Not currently used |
| `PEXELS_KEY` | Not currently used |

---

## Google Sheet structure
Two tabs auto-created by the Apps Script:
- **Subscribers** — Timestamp, Email, Source
- **Feedback** — Timestamp, Vote (yes/no), Message, Email, Source

---

## Features (current — v3)
- **Ingredient input** — type naturally ("2 eggs", "500g chicken", "rice") or use quick-add staple buttons
- **Diet & skill profile** — diet preference, cooking skill level, servings
- **Health conditions** — 8 selectable conditions (Diabetes, High Cholesterol, High Blood Pressure, Heart Disease, Kidney Disease, IBS, Weight Management, Anaemia) with tailored meal rules and "Why this is good for you" insights
- **3 meal suggestions** — name, affirmation quote, description, time, difficulty, ingredient quantities, nutrition, cooking steps
- **Cuisine selector** — 13 options from broad (Any, African, Asian) to specific (West African, East Asian, Caribbean, etc.); passed to the AI prompt to narrow suggestions; honest adaptation naming when ingredients don't naturally fit
- **Triadic colour meal headers** — 3 cards use colour-wheel triadic harmony (terracotta→gold, forest→sage green, plum→terracotta) with frosted-glass emoji box
- **Staggered spring reveal** — 5-stage animation choreography per card (cardReveal → headerReveal → emojiPop → affirmSlide → chipCascade)
- **Aurora loading state** — ambient colour blobs + dual concentric rings + shimmer skeleton cards replace the old spinner
- **Focus mode results** — form hides on results display; only hero + meals shown. "← Try different ingredients" restores the form
- **Stretch meal** — one extra cheap ingredient that unlocks a 4th meal idea
- **Rate a meal** — 👍 / 👎 per meal; ratings influence next generation
- **Share a meal** — WhatsApp, Facebook, download image (html2canvas), copy text; share image includes Plenty branding and URL
- **Share Plenty nudge** — WhatsApp card at bottom of results to share the app with friends
- **Feedback card** — 👍 / 👎 after results with optional text box; if user hasn't subscribed, email prompt appears inline; all saved to Google Sheet Feedback tab
- **Email capture** — separate signup card → Google Sheet Subscribers tab; duplicate-safe
- **Privacy Policy & Terms of Use** — linked in footer, served as static HTML pages

---

## Known architecture decisions
- **No Unsplash/Pexels photos** — gradient placeholders used instead (real food APIs returned irrelevant images for African/diverse dishes)
- **All onclick handlers exposed as `window.X`** — required because functions are defined inside a script block, not globally. Always add `window.X =` for any new function called via onclick
- **meals.js cleans control characters with charCodeAt()** — regex with literal newlines in the file was corrupting Vercel compilation silently
- **claude-haiku not claude-sonnet** — faster, cheaper, avoids timeout on Vercel free tier
- **max_tokens: 1800** — increased from 1200 to handle health condition prompts without truncation; passed from frontend so meals.js stays flexible
- **Feedback goes direct to Sheets URL** — no Vercel function needed, frontend calls Google Apps Script directly with query params
- **Validation rule** — after every edit, run the validator: braces balanced, backticks even, all onclick functions on window.*, node --check passes

---

## Deployment
1. Push to GitHub (`plenty-app` repo)
2. Vercel auto-deploys on every push
3. Live at: `plenty-app-nine.vercel.app`

---

## Roadmap
### Next (Round 1 — get paying users)
- [x] Cuisine choice selector — narrows AI suggestions to a specific cuisine (African, Asian, Mediterranean, etc.); AI names adaptations honestly when ingredients don't naturally fit the chosen cuisine
- [ ] Free vs paid usage limit (3 meals/day free → $4.99–7.99/month)
- [ ] First TikTok/Instagram content video

### Round 2 — wow factor
- [ ] Fridge photo scan
- [ ] Save favourite meals
- [ ] Shopping list generator

### Round 3 — scale
- [ ] Weekly meal planner
- [ ] Language selector
- [ ] Welcome email sequence
