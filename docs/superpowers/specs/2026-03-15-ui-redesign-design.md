# Plenty UI Redesign — Design Spec
**Date:** 2026-03-15
**Approach:** Full Cosmetic Sweep (Approach 1) — CSS and HTML scaffold only, no JS changes
**Goal:** Transform the existing UI into a jaw-dropping, high-retention experience while preserving 100% of existing functionality

---

## 1. Design Direction

**Modern & Layered** — floating card depth, gradient chips, glows on key actions, spring microinteractions. Fresh, energetic, and tactile. Feels like a premium wellness or fintech app.

### Design Tokens

```css
:root {
  /* Backgrounds */
  --cream:           #FFF8F2;   /* warmer than original #F7F3EC */
  --warm-white:      #FFFCF8;

  /* Brand colours */
  --earth:           #2D1A0E;   /* deepened from #3D2B1F */
  --earth-mid:       #4A2E1A;   /* NEW — add to :root */
  --terracotta:      #C4622D;
  --terracotta-light:#E8835A;   /* NEW — add to :root */
  --sage:            #5A7A4E;   /* deepened from #7A8C6E */
  --light-sage:      #E8EDE4;   /* KEPT — existing token, still used */
  --sage-chip:       #D4E4CF;   /* NEW — add to :root */
  --gold:            #D4A847;
  --muted:           #8A7968;

  /* Elevation system — all NEW, add to :root */
  --shadow-float: 0 12px 48px rgba(45,26,14,0.13), 0 3px 12px rgba(45,26,14,0.08);
  --shadow-small: 0 4px 16px rgba(45,26,14,0.10), 0 1px 4px rgba(45,26,14,0.06);
  --shadow-btn:   0 8px 28px rgba(45,26,14,0.22), 0 2px 8px rgba(45,26,14,0.12);
}
```

**Note on `--light-sage`:** The existing `--light-sage: #E8EDE4` token is kept unchanged. Ingredient chip gradients run from `--light-sage` → `--sage-chip` (`#E8EDE4 → #D4E4CF`). No token is deprecated.

**Typography:** Unchanged — Playfair Display (display/serif) + DM Sans (body). Font weights pushed heavier: headings use `font-weight: 800`, labels use `font-weight: 600`.

**Google Fonts update required:** Add weight `800` to the Playfair Display load:
```html
<!-- BEFORE -->
family=Playfair+Display:ital,wght@0,400;0,700;1,400
<!-- AFTER -->
family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400;1,700
```

---

## 2. Hero Section

**Treatment:** Full-bleed gradient (E-style) + stacked-depth input card (F-style)

### HTML changes required

The existing `<header>` block is **replaced** entirely with a new `.hero` div. The existing `<p class="tagline">` is removed; its content is replaced by the new headline + sub-copy. No IDs or JS-referenced elements exist in `<header>`, so this is safe.

**New HTML structure** (replaces lines 635–641):
```html
<div class="hero">
  <div class="hero-deco hero-deco-1">🍲</div>
  <div class="hero-deco hero-deco-2">🥗</div>
  <div class="hero-deco hero-deco-3">🍳</div>
  <div class="hero-logo">
    <div class="hero-logo-icon">🌿</div>
    <span class="hero-logo-text">Plenty</span>
  </div>
  <h1 class="hero-headline">Turn what you have<br>into something <em>beautiful.</em></h1>
  <p class="hero-sub">AI-powered meals from your ingredients — in seconds. No waste, no stress.</p>
</div>
```

### Hero banner CSS
- `.hero`: `position: relative`, `background: linear-gradient(150deg, #1A0A04 0%, #7A2D10 35%, #C4622D 65%, #D4A847 100%)`, `padding: 48px 24px 80px`, `text-align: center`, `overflow: hidden`
- `.hero::before`: existing SVG noise texture at 7% opacity (copy pattern from existing `body::before`)
- `.hero-deco`: `position: absolute`, `font-size: 80px`, `opacity: 0.07`, `pointer-events: none`, `user-select: none`
  - `.hero-deco-1`: `top: -10px; right: -10px; transform: rotate(18deg)`
  - `.hero-deco-2`: `bottom: 30px; left: -15px; transform: rotate(-12deg); font-size: 64px`
  - `.hero-deco-3`: `top: 30px; left: 20px; transform: rotate(-5deg); font-size: 48px; opacity: 0.05`
- `.hero-logo`: `display: inline-flex`, `align-items: center`, `gap: 8px`, `background: rgba(255,255,255,0.1)`, `border: 1px solid rgba(255,255,255,0.18)`, `border-radius: 100px`, `padding: 6px 16px 6px 8px`, `margin-bottom: 28px`, `position: relative`, `z-index: 1`, `backdrop-filter: blur(6px)`
- `.hero-logo-icon`: `width: 28px; height: 28px`, `background: linear-gradient(135deg, var(--terracotta), var(--gold))`, `border-radius: 8px`, `display: flex; align-items: center; justify-content: center`, `font-size: 14px`, `box-shadow: 0 2px 8px rgba(196,98,45,0.4)`
- `.hero-logo-text`: Playfair Display, `font-size: 16px`, `font-weight: 700`, `color: white`, `letter-spacing: -0.3px`
- `.hero-headline`: Playfair Display, `font-size: 36px`, `font-weight: 800`, `color: white`, `line-height: 1.1`, `letter-spacing: -1.5px`, `margin-bottom: 12px`, `text-shadow: 0 2px 20px rgba(0,0,0,0.2)`, `position: relative; z-index: 1`
  - `em` inside: `color: var(--gold)`, `font-style: italic`
- `.hero-sub`: `font-size: 14px`, `color: rgba(255,255,255,0.72)`, `line-height: 1.6`, `max-width: 280px`, `margin: 0 auto`, `position: relative; z-index: 1`

### Stacked input card wrapper

A new `.input-stack-wrapper` div wraps the existing `.input-card` (and only the input card — see Section 3 for profile strip clarification). No changes to existing `.input-card` div ID or JS selectors.

**New wrapper HTML** (wraps the existing `<div class="input-card">` only):
```html
<div class="input-stack-wrapper">
  <!-- existing .input-card div goes here, unchanged -->
</div>
```

CSS for `.input-stack-wrapper`:
- `position: relative`, `max-width: 600px`, `margin: -52px auto 0`, `padding: 0 20px`
- `::before`: `content: ''`, `position: absolute`, `top: -6px; left: 32px; right: 32px`, `height: 100%`, `background: linear-gradient(135deg, rgba(196,98,45,0.10), rgba(212,168,71,0.07))`, `border-radius: 22px`, `border: 1px solid rgba(196,98,45,0.15)`, `transform: rotate(1.8deg)`, `z-index: 0`
- `::after`: `content: ''`, `position: absolute`, `top: -3px; left: 28px; right: 28px`, `height: 100%`, `background: linear-gradient(135deg, rgba(196,98,45,0.06), rgba(212,168,71,0.04))`, `border-radius: 22px`, `border: 1px solid rgba(196,98,45,0.10)`, `transform: rotate(-1.2deg)`, `z-index: 0`

The existing `.input-card` CSS gets: `position: relative; z-index: 2`, `border-radius: 22px` (up from `20px`), `box-shadow: var(--shadow-float)`.

---

## 3. Profile Strip

**Structure unchanged.** `.profile-strip` remains as a sibling `<div>` at the container level, positioned between `<header>` (now `.hero`) and `.health-card`, exactly as it is today. No HTML restructuring.

**Visual treatment:** The profile strip is given a new CSS label row above it (pure CSS, no HTML change needed):
- Pills: `background: #FFF8F2`, `border: 1.5px solid #EDE8E0` — warmer background tint only

A terracotta section label "Your profile" is **not** added in HTML (would require HTML change near a JS-adjacent area). Instead the profile strip sits visually between the hero and health card with its existing layout, styled to match the elevated system via the warmer pill background.

---

## 4. Health Conditions Card

- `.health-card`: `box-shadow: var(--shadow-float)` (was `0 4px 24px rgba(61,43,31,0.06)`)
- `.health-title`: `color: var(--terracotta)` (was `color: var(--earth)`)
- All health condition button styles, toggle arrow, disclaimer: **unchanged**

---

## 5. Ingredient Input & Tags

### Input field (`.ingredient-input`)
- `background: #FFF8F2` (warmer tint, was `var(--cream)`)
- Focus: `box-shadow: 0 0 0 4px rgba(196,98,45,0.07)` (wider glow)
- `border-radius: 14px` (up from `12px`)

### Add button (`.add-btn`)
- Adds `box-shadow: 0 4px 12px rgba(196,98,45,0.35)`

### Ingredient tags (`.ingredient-tag`)
- `background: linear-gradient(135deg, #E8EDE4, #D4E4CF)` (gradient instead of flat `var(--light-sage)`)
- `box-shadow: 0 2px 6px rgba(45,26,14,0.08)`
- `@keyframes tagPop`: update easing to `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring bounce)

### Quick-add pills (`.quick-pill`)
- Hover: `background: linear-gradient(135deg, #E8EDE4, #D4E4CF)` (matches chip gradient)

---

## 6. Generate Button

The most important microinteraction. The existing button HTML is **not changed** — the JS function `updateBtn()` overwrites `btn.textContent` dynamically, so no child span can be reliably maintained. The ✦ spark rotation microinteraction is **removed from scope** as it is unimplementable under the zero-JS constraint.

CSS changes only:

```css
.generate-btn {
  position: relative;          /* REQUIRED for ::before / ::after */
  overflow: hidden;
  background: linear-gradient(135deg, #2D1A0E, #4A2E1A);
  border-radius: 18px;
  padding: 20px 32px;
  font-size: 20px;
  box-shadow: var(--shadow-btn);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
/* Shimmer sweep on hover */
.generate-btn::before {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
  transition: left 0.6s ease;
}
/* Terracotta radial glow on hover */
.generate-btn::after {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at center, rgba(196,98,45,0.3), transparent 70%);
  opacity: 0;
  transition: opacity 0.3s;
}
.generate-btn:hover:not(:disabled) {
  transform: translateY(-3px) scale(1.01);
  box-shadow: 0 16px 48px rgba(45,26,14,0.28), 0 4px 12px rgba(45,26,14,0.14);
}
.generate-btn:hover:not(:disabled)::before { left: 150%; }
.generate-btn:hover:not(:disabled)::after  { opacity: 1; }
.generate-btn:active:not(:disabled) { transform: scale(0.98) translateY(0); transition: all 0.1s; }
```

Note: existing `:disabled` opacity rule preserved unchanged.

---

## 7. Loading State

### HTML changes required

The existing `#loadingState` div content is replaced with a richer scaffold. The existing `display: none` / `display: block` toggling is done by JS via `classList` — the class name `.loading-state` and ID `#loadingState` are unchanged.

**New inner HTML for `#loadingState`:**
```html
<div class="aurora-blob aurora-blob-1"></div>
<div class="aurora-blob aurora-blob-2"></div>
<div class="aurora-blob aurora-blob-3"></div>

<div class="skeleton-card">
  <div class="skeleton-header"></div>
  <div class="skeleton-body">
    <div class="skeleton-line skeleton-title"></div>
    <div class="skeleton-line skeleton-sub"></div>
    <div class="skeleton-line skeleton-sub2"></div>
    <div class="skeleton-chips">
      <div class="skeleton-chip" style="width:64px"></div>
      <div class="skeleton-chip" style="width:48px"></div>
      <div class="skeleton-chip" style="width:72px"></div>
    </div>
  </div>
</div>

<div class="skeleton-card">
  <div class="skeleton-header"></div>
  <div class="skeleton-body">
    <div class="skeleton-line skeleton-title" style="width:50%"></div>
    <div class="skeleton-line skeleton-sub"></div>
    <div class="skeleton-line skeleton-sub2" style="width:60%"></div>
  </div>
</div>

<div class="loading-spinner-wrap">
  <div class="loading-ring"></div>
  <div class="loading-ring-2"></div>
</div>
<p class="loading-text">Finding your meals…</p>
<p class="loading-subtext">Turning your ingredients into something beautiful</p>
```

### New CSS for loading state

The existing `.loading-spinner`, `@keyframes spin`, `.loading-text`, `.loading-subtext` styles are **updated** (not added) to the following:

```css
/* Wrapper */
.loading-state {
  text-align: center;
  padding: 40px 20px;
  position: relative;
  overflow: hidden;
  background: white;
  border-radius: 24px;
  box-shadow: var(--shadow-float);
}

/* Aurora blobs */
.aurora-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(28px);
  animation: auroraBlob 3s ease-in-out infinite alternate;
  pointer-events: none;
}
.aurora-blob-1 { width: 160px; height: 160px; background: rgba(196,98,45,0.15); top: -40px; left: -40px; }
.aurora-blob-2 { width: 120px; height: 120px; background: rgba(212,168,71,0.12); top: -20px; right: -30px; animation-delay: 0.8s; }
.aurora-blob-3 { width: 100px; height: 100px; background: rgba(90,122,78,0.10); bottom: -20px; left: 30px; animation-delay: 1.4s; }
@keyframes auroraBlob {
  from { transform: scale(1) translate(0,0); opacity: 0.7; }
  to   { transform: scale(1.2) translate(8px,8px); opacity: 1; }
}

/* Skeleton cards */
.skeleton-card { background: white; border-radius: 20px; overflow: hidden; margin-bottom: 12px; border: 1px solid #F0EAE2; }
.skeleton-header { height: 100px; background: linear-gradient(90deg, #F0EAE2 25%, #F8F4EF 50%, #F0EAE2 75%); background-size: 400% 100%; animation: shimmer 1.8s ease-in-out infinite; }
.skeleton-body { padding: 16px; }
.skeleton-line { border-radius: 6px; background: linear-gradient(90deg, #F0EAE2 25%, #F8F4EF 50%, #F0EAE2 75%); background-size: 400% 100%; animation: shimmer 1.8s ease-in-out infinite; margin-bottom: 8px; }
.skeleton-title { height: 20px; width: 60%; }
.skeleton-sub   { height: 13px; width: 85%; animation-delay: 0.1s; }
.skeleton-sub2  { height: 13px; width: 70%; animation-delay: 0.2s; }
.skeleton-chips { display: flex; gap: 6px; margin-top: 10px; }
.skeleton-chip  { height: 22px; border-radius: 100px; background: linear-gradient(90deg, #F0EAE2 25%, #F8F4EF 50%, #F0EAE2 75%); background-size: 400% 100%; animation: shimmer 1.8s ease-in-out infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Dual rings */
.loading-spinner-wrap { position: relative; width: 52px; height: 52px; margin: 16px auto 16px; }
.loading-ring  { position: absolute; inset: 0; border-radius: 50%; border: 3px solid transparent; border-top-color: var(--terracotta); animation: spin 0.9s linear infinite; }
.loading-ring-2 { position: absolute; inset: 7px; border-radius: 50%; border: 2px solid transparent; border-top-color: var(--gold); animation: spin 1.4s linear infinite reverse; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Copy */
.loading-text    { font-family: 'Playfair Display', serif; font-style: italic; font-size: 18px; color: var(--earth); position: relative; margin-bottom: 4px; }
.loading-subtext { font-size: 13px; color: #BFB8AE; position: relative; }
```

---

## 8. Meal Result Cards

### Card shell (`.meal-card`)
- `border-radius: 24px` (up from `20px`)
- `box-shadow: var(--shadow-float)`
- Hover: `transform: translateY(-3px)`, `box-shadow: 0 20px 60px rgba(45,26,14,0.16), 0 4px 16px rgba(45,26,14,0.10)`

### Gradient header (`.meal-placeholder`)

**HTML change:** The `.meal-placeholder` div needs an inner flex layout with emoji box + text column side by side. The JS function `renderResults()` builds this HTML dynamically. Since JS cannot change, the **existing JS output HTML is replaced** by updating the HTML string inside `renderResults()`.

> **Exception to zero-JS constraint:** The JS `renderResults()` function builds HTML strings for `.meal-placeholder`. The inner HTML of this template string is not logic — it is a template. Updating the template string to emit the new frosted glass emoji box and left-aligned header layout is treated as a **scaffold change**, not a logic change. No function signatures, event handlers, or `window.*` assignments change.

New `.meal-placeholder` inner layout emitted by the template:
```html
<div class="meal-placeholder meal-placeholder-style-N">
  <div class="meal-emoji-box">EMOJI</div>
  <div class="meal-header-text">
    <div class="meal-header-name">NAME</div>
    <div class="meal-header-badges">
      <span class="header-badge">⏱ TIME</span>
      <span class="header-badge">DIFFICULTY</span>
    </div>
  </div>
</div>
```

**Important:** The class used for the meal name inside the header is **`.meal-header-name`** (not `.meal-name`). This avoids colliding with the existing `.meal-name` class on the `<h3>` in the card body (`.meal-top` area). Do not reuse `.meal-name` here.

Additionally, the JS template exception covers **removing the `.meal-top` block** from the card body template string. Since the meal name and difficulty badges now live in the gradient header, the old `<div class="meal-top"><h3 class="meal-name">...</h3><div class="meal-badges">...</div></div>` block must be **deleted** from the `renderResults()` card innerHTML template to prevent the name and badges appearing twice. This is a template scaffold change (no logic change).

New CSS for header layout:
```css
.meal-placeholder {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  padding: 20px 20px 16px;
  height: auto;             /* remove fixed 180px height */
  min-height: 100px;
}
.meal-emoji-box {
  width: 58px; height: 58px;
  background: rgba(255,255,255,0.18);
  backdrop-filter: blur(8px);
  border: 1.5px solid rgba(255,255,255,0.28);
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 30px;
  flex-shrink: 0;
  position: relative; z-index: 1;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
}
.meal-header-text { flex: 1; position: relative; z-index: 1; }
.meal-header-name {
  font-family: 'Playfair Display', serif;
  font-size: 20px; font-weight: 700;
  color: white;
  text-shadow: 0 1px 6px rgba(0,0,0,0.2);
  margin-bottom: 7px; line-height: 1.2;
}
.meal-header-badges { display: flex; gap: 5px; flex-wrap: wrap; }
.header-badge {
  background: rgba(255,255,255,0.2);
  color: white; border-radius: 100px;
  padding: 3px 10px; font-size: 11px; font-weight: 500;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.25);
}
```

Remove existing `.meal-placeholder-emoji`, `.meal-placeholder-name`, `.meal-placeholder-badges`, `.meal-placeholder-badge` CSS classes (replaced by above).

### Health explanation block (`.health-explanation`)
- Background: `linear-gradient(135deg, #EFF7EC 0%, #E6F2E2 100%)` — unchanged
- Border: `1.5px solid #C0D9B8` — unchanged
- `border-radius: 14px` (up from existing `14px` — no change)
- Add `box-shadow: 0 2px 8px rgba(90,122,78,0.08)` for subtle lift
- `.insight-icon`: add `box-shadow: 0 1px 4px rgba(90,122,78,0.1)`
- All other sub-elements unchanged

### Body
- Affirmation (`.meal-affirmation`): unchanged styling
- Description (`.meal-description`): unchanged
- Section labels (`.meal-section-label`): `font-weight: 600` (up from `500`)

### Ingredient chips (`.ing-chip`)
- `background: linear-gradient(135deg, #E8EDE4, #D4E4CF)`
- `box-shadow: 0 1px 4px rgba(45,26,14,0.08)`

### Nutrition grid (`.nutrition-item`)
- `background: linear-gradient(135deg, #FFF8F2, #FFF3E8)`
- `border: 1px solid #F0EAE2`
- `border-radius: 10px` (up from `8px`)

### Step numbers (`.step-num`)
- `background: linear-gradient(135deg, var(--terracotta), var(--terracotta-light))`
- `box-shadow: 0 2px 6px rgba(196,98,45,0.3)`

### Steps toggle (`.steps-toggle`)
- Hover: `background: #FFF4EE`, `color: var(--terracotta)`

### Rating buttons (`.rating-btn`)
- `background: #FFF8F2`
- Hover: `transform: scale(1.2)`, `border-color: var(--terracotta)`

### Share button (`.share-btn`)
- `box-shadow: 0 4px 16px rgba(196,98,45,0.28)`
- Hover: `transform: translateY(-1px)`, shadow deepens

---

## 9. Card Reveal Animation Sequence

The existing `@keyframes cardSlide` and its `animation-delay` on `:nth-child` selectors are **replaced** with a richer staggered system.

### New keyframes (add to CSS)
```css
@keyframes cardReveal {
  from { opacity: 0; transform: translateY(32px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes headerReveal {
  from { opacity: 0; transform: scale(1.04); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes emojiPop {
  0%   { opacity: 0; transform: scale(0.5); }
  60%  { transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes affirmSlide {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes chipCascade {
  0%   { opacity: 0; transform: scale(0.6); }
  70%  { transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
}
```

### Animation targets (all use CSS class selectors — no JS needed)

| CSS selector | Keyframe | Easing | Base delay |
|---|---|---|---|
| `.meal-card` | `cardReveal 0.6s` | `cubic-bezier(0.22,1,0.36,1)` | `0.05s` |
| `.meal-card:nth-child(2)` | same | same | `0.18s` |
| `.meal-card:nth-child(3)` | same | same | `0.31s` |
| `.meal-placeholder` | `headerReveal 0.8s` | `cubic-bezier(0.22,1,0.36,1)` | `0.10s` |
| `.meal-card:nth-child(2) .meal-placeholder` | same | same | `0.23s` |
| `.meal-card:nth-child(3) .meal-placeholder` | same | same | `0.36s` |
| `.meal-emoji-box` | `emojiPop 0.5s` | `cubic-bezier(0.34,1.56,0.64,1)` | `0.20s` |
| `.meal-card:nth-child(2) .meal-emoji-box` | same | same | `0.33s` |
| `.meal-card:nth-child(3) .meal-emoji-box` | same | same | `0.46s` |
| `.meal-affirmation` | `affirmSlide 0.5s` | `ease` | `0.30s` |
| `.meal-card:nth-child(2) .meal-affirmation` | same | same | `0.43s` |
| `.meal-card:nth-child(3) .meal-affirmation` | same | same | `0.56s` |
| `.ing-chip:nth-child(1)` | `chipCascade 0.4s` | `cubic-bezier(0.34,1.56,0.64,1)` | `0.35s` |
| `.ing-chip:nth-child(2)` | same | same | `0.42s` |
| `.ing-chip:nth-child(3)` | same | same | `0.49s` |
| `.ing-chip:nth-child(4)` | same | same | `0.56s` |
| `.meal-card:nth-child(2) .ing-chip:nth-child(1)` | same | same | `0.48s` |
| `.meal-card:nth-child(2) .ing-chip:nth-child(2)` | same | same | `0.55s` |

All animations use `animation-fill-mode: both` so elements start invisible before the animation fires.

---

## 10. Stretch Card

- `.stretch-card`: `box-shadow: var(--shadow-float)`, `overflow: hidden`, `background: white`
- New `.stretch-header-band` div (HTML change inside `.stretch-card`):
  ```html
  <div class="stretch-header-band">
    <span class="stretch-label-pill">✦ Stretch</span>
    <span class="stretch-header-title"><!-- JS-injected title --></span>
  </div>
  ```
  CSS: `background: linear-gradient(135deg, #D4A847, #E8C56A)`, `padding: 14px 20px`, `display: flex`, `align-items: center`, `gap: 10px`
- `.stretch-label-pill`: frosted glass pill, `background: rgba(255,255,255,0.25)`, `border: 1px solid rgba(255,255,255,0.35)`, `border-radius: 100px`, `padding: 2px 10px`, `font-size: 10px`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 1px`, `color: white`
- Existing `.stretch-label`, `.stretch-header`, `.stretch-title` CSS reworked to target new structure
- `.stretch-item`: `background: linear-gradient(135deg, #FEF8E8, #FDEECA)`, `box-shadow: 0 2px 8px rgba(212,168,71,0.15)` (was flat white)

**JS template scope note:** The stretch card content is built dynamically by `renderResults()` (the stretch card template string). The JS template exception (Section 17, constraint 2) explicitly covers updating this template string to emit the new `.stretch-header-band` structure — alongside the meal card header template. This is purely a scaffold/markup change: no function signatures, event handlers, or `window.*` assignments are modified.

---

## 11. Confidence Banner

- `box-shadow: var(--shadow-float)`
- `position: relative; overflow: hidden`
- Add `::before` pseudo-element: `position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; background: radial-gradient(circle, rgba(212,168,71,0.2), transparent 65%); border-radius: 50%`
- `.big-num`: `text-shadow: 0 0 30px rgba(212,168,71,0.3)` glow added
- Position in results flow: **unchanged** — stays in the same DOM position as today

---

## 12. Feedback Card

- `.feedback-card`: `box-shadow: var(--shadow-float)`
- `.feedback-thumb-btn`: `background: #FFF8F2`, `box-shadow: var(--shadow-small)`
- `.feedback-thumb-btn:hover`: `box-shadow: 0 6px 20px rgba(196,98,45,0.18)`, `border-color: var(--terracotta)`

---

## 13. Email Signup Card

- `box-shadow: var(--shadow-float)`
- `position: relative; overflow: hidden`
- Add `::before` pseudo-element: terracotta radial glow, `position: absolute; bottom: -40px; left: -40px; width: 160px; height: 160px; background: radial-gradient(circle, rgba(196,98,45,0.18), transparent 65%); border-radius: 50%`
- `.email-submit-btn`: `box-shadow: 0 4px 14px rgba(196,98,45,0.35)`

---

## 14. Share Nudge Card

- `box-shadow: var(--shadow-float)`
- `position: relative; overflow: hidden`
- Add `::before` pseudo-element: sage radial glow, `position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; background: radial-gradient(circle, rgba(168,196,154,0.2), transparent 65%); border-radius: 50%`
- `.share-nudge-btn`: `box-shadow: 0 4px 16px rgba(0,0,0,0.15)`

---

## 15. Try Again Button

- `border-radius: 14px` (up from `12px`)
- Hover: `border-color: var(--terracotta)`, `color: var(--terracotta)` — unchanged

---

## 16. Footer

- Unchanged — `color: #C5BDB2`, links `color: var(--terracotta)`

---

## 17. Implementation Constraints

1. **Single file** — all changes live in `index.html`. No new files created.
2. **JS untouched** — zero changes to any `<script>` logic, function signatures, `window.*` assignments, or event handlers. The only permitted changes to JS are: (a) updating the meal card header template string inside `renderResults()` to emit the new frosted glass emoji box layout and remove the old `.meal-top` block (Section 8), and (b) updating the stretch card template string inside `renderResults()` to emit the new `.stretch-header-band` layout (Section 10). Both are markup-only template scaffold changes.
3. **All IDs and `onclick` handlers preserved** — `id="generateBtn"`, `id="loadingState"`, `id="resultsSection"`, etc. are unchanged. No HTML restructuring that would break `getElementById` calls.
4. **Validation rule** — after every edit: braces balanced, backticks even, all onclick functions on `window.*`, `node --check` passes.
5. **No new external dependencies** — no new CDN links. Exception: update existing Google Fonts `<link>` to add Playfair Display weight 800 (see Section 1).
6. **Performance** — all new animations use `transform` and `opacity` only (GPU-composited). Aurora blobs use `filter: blur()` (GPU-accelerated). No `width`, `height`, `top`, `left` animations.
7. **Mobile** — all existing `@media` breakpoints preserved. New shadow values and border-radii scale correctly at all viewports.
8. **`--light-sage` preserved** — existing `--light-sage: #E8EDE4` token kept in `:root`. New tokens `--earth-mid`, `--terracotta-light`, `--sage-chip` and shadow variables added alongside it.

---

## 18. Sections Unchanged

The following are functionally and visually identical to current implementation:
- Share modal overlay (`.share-modal-overlay`, `.share-modal`, `.share-option`)
- Share card capture (`.share-card-capture` and all sub-elements — off-screen html2canvas target)
- Health condition grid layout and button states (only header label colour changes)
- Privacy / Terms modal content
- Error state (`.error-state`) — used for both generic errors and 429 rate-limit responses; no separate "rate limiting UI" class exists
- Feedback detail, textarea, and inline email prompt (`.feedback-detail`, `.feedback-textarea`, `.feedback-email-prompt`)

---

## Summary of Visual Delta

| Property | Before | After |
|---|---|---|
| Page background | `#F7F3EC` flat | `#FFF8F2` warmer flat |
| Card shadows | Single `0 4px 24px` | Two-layer float system |
| Card border-radius | `20px` | `22–24px` |
| Hero | Logo + tagline centred | Full-bleed gradient, big headline, decorative emojis, frosted logo pill |
| Input card | Flat, sibling of hero | Wrapped in stacked-depth ghost layers, overlaps hero by 52px |
| Profile strip | Standalone centred | Unchanged position, warmer pill background |
| Ingredient chips | Flat `#E8EDE4` | Gradient `#E8EDE4 → #D4E4CF` + shadow |
| Ingredient tag animation | Spring `cubic-bezier(0.34,1.56,0.64,1)` (unchanged) | Same — no change needed |
| Quick-add pill hover | Flat sage | Gradient |
| Generate button | Flat dark, single shadow | Shimmer sweep + glow + spring-back + deeper shadow |
| Loading | Single spinner + copy | Skeleton cards + dual rings + aurora blobs + copy |
| Meal card border-radius | `20px` | `24px` |
| Meal card header layout | Emoji centred, full width | Frosted glass emoji box left + name/badges right |
| Meal card reveal | Simple `cardSlide` fade | 5-stage staggered spring choreography |
| Nutrition items | Flat `--cream` | Warm gradient tint |
| Step numbers | Flat terracotta circle | Gradient terracotta + shadow |
| Health explanation | Flat green card | + subtle box shadow |
| Stretch card | Flat gradient card | White float + gold band header + frosted pill |
| Confidence banner | Flat dark | Float shadow + gold radial glow |
| Feedback card | Flat white | Float shadow + warmer thumb buttons |
| Email card | Flat dark gradient | + float shadow + terracotta glow accent |
| Share nudge card | Flat sage gradient | + float shadow + sage glow accent |
| Google Fonts link | Playfair 400/700 | + weight 800 added |
