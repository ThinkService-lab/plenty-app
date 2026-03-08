# Plenty — AI Meal Suggestion App
> "You already have everything you need to eat well tonight."

## What it does
Plenty takes whatever ingredients you have and suggests 3 complete meals you can make right now. The tone is empowering and abundant — never making users feel like they "only" have a few things. Built for people experiencing food cost pressure or psychological scarcity around food.

---

## Repo structure
```
/
├── index.html          ← entire frontend (single file)
├── vercel.json         ← Vercel routing + function config
├── README.md           ← this file
└── api/
    ├── meals.js        ← Anthropic API proxy (main AI route)
    ├── subscribe.js    ← email capture → Google Sheets
    └── photo.js        ← unused (gradient placeholders used instead)
```

---

## Tech stack
| Layer | Tool |
|---|---|
| Frontend | Vanilla HTML/CSS/JS (single file) |
| Backend | Vercel serverless functions |
| AI | Claude Haiku (`claude-haiku-4-5-20251001`) |
| Email capture | Google Apps Script → Google Sheet |
| Hosting | Vercel (free tier, auto-deploy from GitHub) |

---

## Environment variables (set in Vercel dashboard)
| Variable | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | `api/meals.js` |
| `UNSPLASH_KEY` | Not currently used |
| `PEXELS_KEY` | Not currently used |

---

## Features (baseline v1)
- **Ingredient input** — type naturally ("2 eggs", "500g chicken", "rice") or use quick-add staple buttons
- **Diet & skill profile** — diet preference, cooking skill level, servings
- **Health conditions** — 8 selectable conditions (Diabetes, High Cholesterol, High Blood Pressure, Heart Disease, Kidney Disease, IBS, Weight Management, Anaemia) with tailored meal rules and "Why this is good for you" insights
- **3 meal suggestions** — name, affirmation quote, description, time, difficulty, ingredient quantities, nutrition, cooking steps
- **Gradient meal headers** — 3 rotating visual styles (terracotta, sage, earth) with emoji + time/difficulty badges
- **Stretch meal** — one extra cheap ingredient that unlocks a 4th meal idea
- **Rate a meal** — 👍 / 👎 per meal; ratings influence next generation
- **Share a meal** — WhatsApp, Facebook, download image (html2canvas), copy text
- **Email capture** — post-results signup card → Google Sheet

---

## Known architecture decisions
- **No Unsplash/Pexels photos** — gradient placeholders used instead (real food APIs returned irrelevant images for African/diverse dishes)
- **All onclick handlers exposed as `window.X`** — required because functions are defined inside a script block, not globally
- **meals.js cleans control characters with charCodeAt()** — regex with literal newlines in the file was corrupting Vercel compilation silently
- **claude-haiku not claude-sonnet** — faster, cheaper, avoids timeout on Vercel free tier
- **max_tokens: 1200** — keeps response fast and within haiku limits

---

## Deployment
1. Push to GitHub (`plenty-app` repo)
2. Vercel auto-deploys on every push
3. Live at: `plenty-app-nine.vercel.app`

---

## Roadmap
### Next (Round 1 — get paying users)
- [ ] Free vs paid usage limit (3 meals/day free → $4.99–7.99/month)

### Round 2 — wow factor
- [ ] Fridge photo scan
- [ ] Save favourite meals
- [ ] Shopping list generator

### Round 3 — scale
- [ ] Weekly meal planner
- [ ] Language selector
- [ ] Welcome email sequence
