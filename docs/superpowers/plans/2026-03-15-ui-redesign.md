# Plenty App UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## CONTINUATION PROMPT (copy-paste to resume after closing terminal)

```
Resume the Plenty app UI redesign implementation on branch `ui-redesign-v3`.
The plan is at: docs/superpowers/plans/2026-03-15-ui-redesign.md
The spec is at: docs/superpowers/specs/2026-03-15-ui-redesign-design.md
The only file to edit is: index.html

Check the plan for unchecked boxes (- [ ]) to find where we left off.
Then use superpowers:executing-plans to continue from the first unchecked task.
Do NOT re-do any checked steps (- [x]).
Branch: ui-redesign-v3 (DO NOT touch main — app is live on Vercel from main)
```

---

## PROGRESS TRACKER

| Chunk | Status | Description |
|-------|--------|-------------|
| Chunk 1 | ⬜ | Design tokens + Google Fonts |
| Chunk 2 | ⬜ | Hero section + stacked input wrapper |
| Chunk 3 | ⬜ | Profile strip, health card, ingredient inputs |
| Chunk 4 | ⬜ | Generate button microinteraction |
| Chunk 5 | ⬜ | Loading state (skeleton + aurora + rings) |
| Chunk 6 | ⬜ | Meal card CSS (shell + animations + body) |
| Chunk 7 | ⬜ | JS template string updates |
| Chunk 8 | ⬜ | Results section supporting cards |
| Chunk 9 | ⬜ | End-to-end validation + branch push |

**Update this table as you complete each chunk by changing ⬜ to ✅.**

---

**Goal:** Transform the Plenty app's single-file UI into a jaw-dropping "Modern & Layered" design with floating card depth, aurora loading, and staggered spring reveal animations — zero functional changes.

**Architecture:** All changes are CSS additions/replacements and two JS template-string scaffold updates inside `renderResults()`. No function signatures, event handlers, API calls, or logic is modified.

**Tech Stack:** Vanilla HTML/CSS/JS, Google Fonts (Playfair Display + Inter), CSS custom properties, `@keyframes` animations, CSS `backdrop-filter`

---

## Chunk 1: Design Tokens + Google Fonts

### Task 1: Update Google Fonts link and CSS custom properties

**Files:**
- Modify: `index.html` (line 7 — Fonts link; lines 9–28 — `:root` block)

- [ ] **Step 1: Read the current `:root` block**

Run: open `index.html`, confirm lines 9–28 contain the existing `:root` tokens.

- [ ] **Step 2: Update the Google Fonts `<link>` tag**

Find line 7 (the `<link>` for Google Fonts). It currently loads weights `400;500;600;700` for Playfair Display. Add weight `800`.

Old:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
```

New:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;700;800&display=swap" rel="stylesheet">
```

- [ ] **Step 3: Add new design tokens to `:root`**

After the last existing token inside `:root { ... }`, append these new tokens (keep all existing tokens intact):

```css
  /* Elevation system */
  --shadow-float: 0 12px 48px rgba(45,26,14,0.13), 0 3px 12px rgba(45,26,14,0.08);
  --shadow-hover: 0 20px 64px rgba(45,26,14,0.18), 0 6px 20px rgba(45,26,14,0.12);
  --shadow-card: 0 4px 24px rgba(45,26,14,0.09), 0 1px 6px rgba(45,26,14,0.06);

  /* Hero gradient */
  --hero-gradient: linear-gradient(150deg, #1A0A04 0%, #7A2D10 35%, #C4622D 65%, #D4A847 100%);

  /* Frosted glass */
  --glass-bg: rgba(255,255,255,0.18);
  --glass-border: rgba(255,255,255,0.28);

  /* Animation easing */
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
```

- [ ] **Step 4: Verify the file opens without errors**

Open `index.html` in a browser (or `open index.html`) — page should load identically to before (no visual change yet, just tokens added).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "design: add elevation tokens, hero gradient, and Playfair 800 weight"
```

---

## Chunk 2: Hero Section + Stacked Input Wrapper

### Task 2: Replace `<header>` with `.hero` + wrap input card

**Files:**
- Modify: `index.html` (lines 635–641 header block; line 683 input-card div; CSS ~lines 29–102)

- [ ] **Step 1: Read lines 620–700 of index.html**

Confirm the current `<header>` tag structure and the `.input-card` div location.

- [ ] **Step 2: Replace the `<header>` block with `.hero`**

Find:
```html
<header>
```
(The opening tag of the header element around line 635.)

Replace the entire header element (opening through closing `</header>`) with:
```html
<div class="hero">
  <div class="hero-content">
    <p class="hero-eyebrow">Your personal meal planner</p>
    <h1 class="hero-headline">What will you<br><em>eat today?</em></h1>
    <p class="hero-sub">Tell us your preferences and we'll craft personalized meal suggestions just for you.</p>
  </div>
</div>
```

- [ ] **Step 3: Wrap `.input-card` in `.input-stack-wrapper`**

Find the div with `class="input-card"` (around line 683). Wrap it:

Before:
```html
        <div class="input-card">
```

After:
```html
        <div class="input-stack-wrapper">
        <div class="input-card">
```

And find the matching closing `</div>` of `.input-card` and add one more closing div after it:
```html
        </div><!-- /.input-card -->
        </div><!-- /.input-stack-wrapper -->
```

- [ ] **Step 4: Add hero CSS**

Find the existing `header { ... }` CSS rule (around line 29) and replace the entire `header` block with:

```css
.hero {
  background: var(--hero-gradient);
  padding: 80px 20px 100px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 40% at 20% 50%, rgba(196,98,45,0.25) 0%, transparent 60%),
    radial-gradient(ellipse 40% 60% at 80% 30%, rgba(212,168,71,0.18) 0%, transparent 55%);
  pointer-events: none;
}

.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 30% 50% at 60% 70%, rgba(196,98,45,0.06) 0%, transparent 50%),
    radial-gradient(ellipse 50% 30% at 30% 20%, rgba(212,168,71,0.04) 0%, transparent 50%);
  pointer-events: none;
}

.hero-content {
  position: relative;
  z-index: 1;
  max-width: 600px;
  margin: 0 auto;
}

.hero-eyebrow {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(212,168,71,0.85);
  margin-bottom: 16px;
}

.hero-headline {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2.4rem, 6vw, 3.8rem);
  font-weight: 800;
  line-height: 1.15;
  color: #FFFBF5;
  margin-bottom: 20px;
}

.hero-headline em {
  font-style: italic;
  color: #D4A847;
}

.hero-sub {
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  color: rgba(255,251,245,0.72);
  max-width: 420px;
  margin: 0 auto;
  line-height: 1.6;
}
```

- [ ] **Step 5: Add `.input-stack-wrapper` CSS**

After the hero CSS block, add:

```css
.input-stack-wrapper {
  position: relative;
  margin-top: -60px;
  z-index: 10;
}

.input-stack-wrapper::before {
  content: '';
  position: absolute;
  inset: 8px 12px -8px;
  background: #fff;
  border-radius: 28px;
  opacity: 0.45;
  box-shadow: var(--shadow-card);
}

.input-stack-wrapper::after {
  content: '';
  position: absolute;
  inset: 4px 6px -4px;
  background: #fff;
  border-radius: 26px;
  opacity: 0.65;
  box-shadow: var(--shadow-card);
}

.input-card {
  position: relative;
  z-index: 1;
}
```

- [ ] **Step 6: Verify visually**

Open `index.html` in browser. You should see a dark amber gradient hero section with headline text, and the white input card floating with stacked depth layers beneath it.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "design: add hero gradient section and stacked-depth input card wrapper"
```

---

## Chunk 3: Profile Strip, Health Card, Ingredient Inputs

### Task 3: Elevate form section elements

**Files:**
- Modify: `index.html` (CSS for `.profile-strip`, `.health-card`, `.ingredient-input`, `.ingredient-tag`)

- [ ] **Step 1: Update `.profile-strip` CSS**

Find the existing `.profile-strip` CSS rule. Update it to add floating shadow:

```css
.profile-strip {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
```

Add after it:

```css
.profile-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 50px;
  font-size: 0.82rem;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  background: linear-gradient(135deg, rgba(196,98,45,0.10) 0%, rgba(212,168,71,0.08) 100%);
  border: 1px solid rgba(196,98,45,0.18);
  color: var(--warm-brown);
  cursor: pointer;
  transition: all 0.2s var(--ease-out-expo);
  box-shadow: var(--shadow-card);
}

.profile-chip:hover,
.profile-chip.active {
  background: linear-gradient(135deg, rgba(196,98,45,0.18) 0%, rgba(212,168,71,0.14) 100%);
  border-color: rgba(196,98,45,0.35);
  box-shadow: var(--shadow-float);
  transform: translateY(-1px);
}
```

- [ ] **Step 2: Update `.health-card` CSS**

Find the existing `.health-card` CSS rule and add `box-shadow: var(--shadow-card);` and a smooth hover transition:

```css
.health-card {
  /* keep all existing properties */
  box-shadow: var(--shadow-card);
  transition: box-shadow 0.25s var(--ease-out-expo), transform 0.25s var(--ease-out-expo);
}

.health-card:hover {
  box-shadow: var(--shadow-float);
  transform: translateY(-2px);
}
```

- [ ] **Step 3: Update ingredient input styling**

Find the `.ingredient-input` CSS rule. Add:

```css
.ingredient-input {
  /* keep existing properties */
  transition: border-color 0.2s, box-shadow 0.2s;
}

.ingredient-input:focus {
  border-color: var(--primary-orange);
  box-shadow: 0 0 0 3px rgba(196,98,45,0.12);
  outline: none;
}
```

- [ ] **Step 4: Update ingredient tag styling**

Find the `.ingredient-tag` CSS rule and update to gradient style:

```css
.ingredient-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 50px;
  font-size: 0.8rem;
  font-weight: 500;
  background: linear-gradient(135deg, rgba(196,98,45,0.12) 0%, rgba(212,168,71,0.09) 100%);
  border: 1px solid rgba(196,98,45,0.20);
  color: var(--warm-brown);
  animation: tagPop 0.3s var(--spring) both;
}

@keyframes tagPop {
  from { opacity: 0; transform: scale(0.7); }
  to   { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 5: Verify**

Open browser, add an ingredient tag — confirm the gradient style and pop animation appear.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "design: gradient chips, elevated health card, focus ring on ingredient input"
```

---

## Chunk 4: Generate Button Microinteraction

### Task 4: Shimmer sweep + spring-back on generate button

**Files:**
- Modify: `index.html` (CSS for `.generate-btn`)

- [ ] **Step 1: Read current `.generate-btn` CSS**

Confirm the button has `position: relative` (required for `::before` shimmer overlay). If it doesn't, add it.

- [ ] **Step 2: Add shimmer keyframe + button CSS updates**

```css
@keyframes shimmerSweep {
  0%   { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translateX(250%) skewX(-15deg); opacity: 0; }
}

.generate-btn {
  /* keep all existing properties */
  position: relative;
  overflow: hidden;
  transition: transform 0.15s var(--spring), box-shadow 0.2s;
}

.generate-btn::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
  transform: translateX(-100%) skewX(-15deg);
  pointer-events: none;
}

.generate-btn:hover::before {
  animation: shimmerSweep 0.65s var(--ease-out-expo) forwards;
}

.generate-btn:active {
  transform: scale(0.97);
}

.generate-btn:hover {
  box-shadow: var(--shadow-hover);
  transform: translateY(-2px);
}
```

- [ ] **Step 3: Verify**

Hover the generate button — you should see a shimmer light sweep left-to-right. Click it — button should scale down slightly (spring-back).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "design: shimmer sweep and spring-back microinteraction on generate button"
```

---

## Chunk 5: Loading State (Skeleton + Aurora + Rings)

### Task 5: Replace loading spinner with skeleton cards + aurora blobs

**Files:**
- Modify: `index.html` (HTML around line 716; CSS for loading state)

- [ ] **Step 1: Read the current `#loadingState` HTML block**

Confirm lines 716–720 contain the current spinner/loading markup.

- [ ] **Step 2: Replace `#loadingState` inner content**

Find the `<div id="loadingState"` element. Replace everything between its opening tag and closing `</div>` with:

```html
  <div class="aurora-container">
    <div class="aurora-blob aurora-blob-1"></div>
    <div class="aurora-blob aurora-blob-2"></div>
    <div class="aurora-blob aurora-blob-3"></div>
  </div>
  <div class="loading-rings">
    <div class="ring ring-outer"></div>
    <div class="ring ring-inner"></div>
  </div>
  <p class="loading-text">Crafting your perfect meals…</p>
  <div class="skeleton-grid">
    <div class="skeleton-card">
      <div class="skeleton-line skeleton-title"></div>
      <div class="skeleton-line skeleton-sub"></div>
      <div class="skeleton-line skeleton-body"></div>
      <div class="skeleton-line skeleton-body short"></div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-line skeleton-title"></div>
      <div class="skeleton-line skeleton-sub"></div>
      <div class="skeleton-line skeleton-body"></div>
      <div class="skeleton-line skeleton-body short"></div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-line skeleton-title"></div>
      <div class="skeleton-line skeleton-sub"></div>
      <div class="skeleton-line skeleton-body"></div>
      <div class="skeleton-line skeleton-body short"></div>
    </div>
  </div>
```

- [ ] **Step 3: Add loading state CSS**

Find the existing `.meal-placeholder` CSS block (around lines 165–219) and replace the entire block with:

```css
/* ── Loading State ──────────────────────────────── */
#loadingState {
  position: relative;
  padding: 60px 20px;
  text-align: center;
  overflow: hidden;
}

.aurora-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.aurora-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.35;
}

.aurora-blob-1 {
  width: 300px; height: 300px;
  background: radial-gradient(circle, #C4622D 0%, transparent 70%);
  top: -80px; left: -60px;
  animation: auroraFloat1 6s ease-in-out infinite;
}

.aurora-blob-2 {
  width: 250px; height: 250px;
  background: radial-gradient(circle, #D4A847 0%, transparent 70%);
  top: 20px; right: -40px;
  animation: auroraFloat2 7s ease-in-out infinite;
}

.aurora-blob-3 {
  width: 200px; height: 200px;
  background: radial-gradient(circle, #7A2D10 0%, transparent 70%);
  bottom: 0; left: 40%;
  animation: auroraFloat1 8s ease-in-out infinite reverse;
}

@keyframes auroraFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%       { transform: translate(30px, -20px) scale(1.1); }
  66%       { transform: translate(-20px, 15px) scale(0.95); }
}

@keyframes auroraFloat2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%       { transform: translate(-25px, 20px) scale(1.08); }
}

.loading-rings {
  position: relative;
  display: inline-block;
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
}

.ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid transparent;
  animation: ringRotate 2s linear infinite;
}

.ring-outer {
  inset: 0;
  border-top-color: #C4622D;
  border-right-color: rgba(196,98,45,0.3);
}

.ring-inner {
  inset: 12px;
  border-top-color: #D4A847;
  border-right-color: rgba(212,168,71,0.3);
  animation-direction: reverse;
  animation-duration: 1.4s;
}

@keyframes ringRotate {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-family: 'Inter', sans-serif;
  font-size: 0.95rem;
  color: var(--medium-gray);
  margin-bottom: 32px;
  font-style: italic;
  position: relative;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  max-width: 960px;
  margin: 0 auto;
  position: relative;
}

.skeleton-card {
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow-card);
}

@keyframes skeletonShimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}

.skeleton-line {
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(90deg, #f0e8df 25%, #faf5f0 50%, #f0e8df 75%);
  background-size: 800px 100%;
  animation: skeletonShimmer 1.6s ease-in-out infinite;
  margin-bottom: 12px;
}

.skeleton-title  { height: 22px; width: 65%; }
.skeleton-sub    { height: 12px; width: 40%; }
.skeleton-body   { height: 12px; width: 90%; }
.skeleton-body.short { width: 70%; }
```

- [ ] **Step 4: Verify**

Click "Generate Meals" — the new loading state should show aurora blobs, dual rotating rings, italic text, and shimmer skeleton cards. No broken layout.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "design: aurora + skeleton loading state replaces spinner"
```

---

## Chunk 6: Meal Card CSS (Shell + Animations + Body)

### Task 6: Floating meal card with staggered spring reveal animations

**Files:**
- Modify: `index.html` (CSS for `.meal-card` and all child elements + keyframes)

- [ ] **Step 1: Read current `.meal-card` CSS**

Confirm the existing `.meal-card` rules so you can preserve selectors you're not changing.

- [ ] **Step 2: Update `.meal-card` shell CSS**

Find the existing `.meal-card { ... }` rule and update:

```css
.meal-card {
  background: #fff;
  border-radius: 24px;
  box-shadow: var(--shadow-float);
  overflow: hidden;
  position: relative;
  transition: box-shadow 0.3s var(--ease-out-expo), transform 0.3s var(--ease-out-expo);
  animation: cardReveal 0.6s var(--spring) both;
}

.meal-card:hover {
  box-shadow: var(--shadow-hover);
  transform: translateY(-4px);
}
```

- [ ] **Step 3: Add card reveal keyframes**

Add these keyframes (place them with other `@keyframes` blocks in the CSS):

```css
@keyframes cardReveal {
  from { opacity: 0; transform: translateY(32px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes headerReveal {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes emojiPop {
  0%   { transform: scale(0) rotate(-15deg); }
  70%  { transform: scale(1.15) rotate(5deg); }
  100% { transform: scale(1) rotate(0deg); }
}

@keyframes affirmSlide {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes chipCascade {
  from { opacity: 0; transform: translateY(8px) scale(0.9); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

- [ ] **Step 4: Add staggered animation delays to card children**

```css
.meal-card-header {
  animation: headerReveal 0.4s var(--ease-out-expo) 0.1s both;
}

.meal-emoji-box {
  animation: emojiPop 0.5s var(--spring) 0.2s both;
}

.meal-affirm {
  animation: affirmSlide 0.4s var(--ease-out-expo) 0.3s both;
}

.meal-tags .tag,
.meal-macros .macro-chip {
  animation: chipCascade 0.35s var(--spring) both;
}

.meal-tags .tag:nth-child(1),
.meal-macros .macro-chip:nth-child(1) { animation-delay: 0.38s; }
.meal-tags .tag:nth-child(2),
.meal-macros .macro-chip:nth-child(2) { animation-delay: 0.44s; }
.meal-tags .tag:nth-child(3),
.meal-macros .macro-chip:nth-child(3) { animation-delay: 0.50s; }
.meal-tags .tag:nth-child(4),
.meal-macros .macro-chip:nth-child(4) { animation-delay: 0.56s; }
```

- [ ] **Step 5: Add `.meal-card-header` CSS (frosted glass header box)**

```css
.meal-card-header {
  position: relative;
  padding: 20px 24px 16px;
  background: linear-gradient(135deg, rgba(196,98,45,0.06) 0%, rgba(212,168,71,0.04) 100%);
  border-bottom: 1px solid rgba(196,98,45,0.10);
  display: flex;
  align-items: center;
  gap: 14px;
}

.meal-emoji-box {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.meal-header-name {
  font-family: 'Playfair Display', serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--dark-text);
  line-height: 1.3;
}

.meal-header-name span {
  display: block;
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--medium-gray);
  margin-top: 2px;
}
```

- [ ] **Step 6: Update macro chip and tag styling**

```css
.macro-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 50px;
  font-size: 0.78rem;
  font-weight: 600;
  background: linear-gradient(135deg, rgba(196,98,45,0.09) 0%, rgba(212,168,71,0.07) 100%);
  border: 1px solid rgba(196,98,45,0.15);
  color: var(--warm-brown);
}
```

- [ ] **Step 7: Verify**

Generate meals and watch cards load. Each card should float in, header should fade down, emoji should pop, affirm text slides left-to-right, chips cascade in one-by-one.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "design: floating meal cards with 5-stage staggered spring reveal animations"
```

---

## Chunk 7: JS Template String Updates

### Task 7: Update `renderResults()` meal card scaffold and stretch card

**Files:**
- Modify: `index.html` (JS template literal around lines 1151–1183; stretch card around lines 1228–1234)

> Note: These are the ONLY two permitted JS changes. We are updating HTML scaffold strings inside template literals — no logic, no functions, no handlers are changed.

- [ ] **Step 1: Read lines 1140–1200 of index.html**

Confirm the current `photoHtml` template string and the `card.set-markup` call structure.

- [ ] **Step 2: Update the meal card header template**

Find the block that builds the meal card header (around line 1151). It currently creates a `.meal-top` div with emoji and meal name. Replace the template markup for the card header section with:

```javascript
const headerHtml = `
  <div class="meal-card-header">
    <div class="meal-emoji-box">${meal.emoji || '🍽️'}</div>
    <div class="meal-header-name">
      ${meal.name}
      <span>${meal.cuisine || ''}</span>
    </div>
  </div>
`;
```

Then in the card template where `.meal-top` used to appear, replace it with `${headerHtml}`.

- [ ] **Step 3: Remove the orphaned `.meal-top` block**

Find and delete the old `.meal-top` HTML block from the template (the one that previously rendered inside `card.innerHTML`). This block is now replaced by `.meal-card-header` above.

- [ ] **Step 4: Update stretch card template**

Find the `stretchCard` or stretch meal section (around lines 1228–1234). Update its header to use the same gold-band frosted-glass style:

```javascript
const stretchHeaderHtml = `
  <div class="meal-card-header" style="background: linear-gradient(135deg, rgba(212,168,71,0.12) 0%, rgba(196,98,45,0.08) 100%); border-bottom-color: rgba(212,168,71,0.20);">
    <div class="meal-emoji-box">${stretchMeal.emoji || '✨'}</div>
    <div class="meal-header-name">
      ${stretchMeal.name}
      <span>Your stretch suggestion</span>
    </div>
  </div>
`;
```

- [ ] **Step 5: Verify — generate meals end-to-end**

Generate meals with real API call. Confirm:
- Each card shows the frosted-glass emoji box + Playfair name in the header
- The stretch card has a gold-tinted header variant
- No duplicate meal names appear (`.meal-top` fully removed)
- Cuisine info appears as subtitle text under the meal name

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "design: update meal card header template to frosted glass layout, update stretch card"
```

---

## Chunk 8: Results Section Supporting Cards

### Task 8: Nutrition summary, confidence banner, health explanation

**Files:**
- Modify: `index.html` (CSS for `.nutrition-summary`, `.confidence-banner`, `.health-explanation`, `.results-header`)

- [ ] **Step 1: Update `.results-header` / section title**

Find the results section header CSS. Update with Playfair font and bottom border treatment:

```css
.results-header {
  font-family: 'Playfair Display', serif;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--dark-text);
  margin-bottom: 24px;
}
```

- [ ] **Step 2: Update `.nutrition-summary` card**

```css
.nutrition-summary {
  background: #fff;
  border-radius: 20px;
  box-shadow: var(--shadow-card);
  padding: 24px;
  transition: box-shadow 0.25s var(--ease-out-expo), transform 0.25s var(--ease-out-expo);
}

.nutrition-summary:hover {
  box-shadow: var(--shadow-float);
  transform: translateY(-2px);
}
```

- [ ] **Step 3: Update `.confidence-banner` styling**

```css
.confidence-banner {
  background: linear-gradient(135deg, rgba(196,98,45,0.07) 0%, rgba(212,168,71,0.05) 100%);
  border: 1px solid rgba(196,98,45,0.15);
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--shadow-card);
}
```

- [ ] **Step 4: Update `.health-explanation` card**

```css
.health-explanation {
  background: #fff;
  border-radius: 20px;
  box-shadow: var(--shadow-card);
  padding: 24px;
  border-left: 4px solid var(--primary-orange);
  transition: box-shadow 0.25s var(--ease-out-expo);
}

.health-explanation:hover {
  box-shadow: var(--shadow-float);
}
```

- [ ] **Step 5: Verify**

Generate meals and scroll the results section. All supporting cards should have consistent elevation, smooth hover lifts, and the gradient ambient lighting system looks cohesive.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "design: elevate results section supporting cards with consistent shadow system"
```

---

## Chunk 9: End-to-End Validation + Branch Push

### Task 9: Full validation sweep and push to remote

**Files:**
- Read: `index.html` (final review)
- Git: push `ui-redesign-v3` to remote

- [ ] **Step 1: Run full functionality check**

Open `index.html` in browser. Test each user flow:
1. Enter name and profile — confirm profile chips render with gradient style
2. Add ingredients — confirm tagPop animation fires
3. Select dietary options — confirm chip active states
4. Click Generate — confirm aurora loading state appears
5. Wait for results — confirm staggered card reveal animations play
6. Hover cards — confirm float lift effect
7. Hover generate button — confirm shimmer sweep
8. Check stretch card — confirm gold-tinted header variant

- [ ] **Step 2: Check for CSS conflicts**

Open browser DevTools. Verify:
- No CSS `Cannot find property` warnings
- No `backdrop-filter` fallback needed (add `-webkit-backdrop-filter` if Safari support needed)
- `.meal-header-name` class is NOT conflicting with any old `.meal-name` rule

- [ ] **Step 3: Check for JS errors**

In DevTools Console, confirm:
- No uncaught JS errors after generating meals
- `renderResults()` runs without exceptions
- Stretch card renders correctly

- [ ] **Step 4: Verify Vercel will NOT auto-deploy**

Confirm you are on `ui-redesign-v3`:
```bash
git branch
```
Output should show `* ui-redesign-v3`

Confirm `main` is untouched:
```bash
git log --oneline main | head -5
```
Output should show the original commits from before this work.

- [ ] **Step 5: Push branch to remote**

```bash
git push -u origin ui-redesign-v3
```

This creates a remote branch for backup and sharing. It does NOT trigger Vercel deployment (Vercel is configured to deploy from `main` only).

- [ ] **Step 6: Update progress tracker**

Update the PROGRESS TRACKER table at the top of this plan file — change all ⬜ to ✅.

- [ ] **Step 7: Final commit**

```bash
git add docs/superpowers/plans/2026-03-15-ui-redesign.md
git commit -m "docs: mark UI redesign plan as complete"
```

---

## Merging to Production

When you are satisfied with the redesign on `ui-redesign-v3`, merge to `main` to deploy:

```bash
git checkout main
git merge ui-redesign-v3
git push origin main
```

Vercel will auto-deploy from `main` within ~60 seconds of the push.

**Before merging, confirm:**
- [ ] All 9 chunks complete (progress tracker shows all ✅)
- [ ] No JS errors in DevTools Console
- [ ] Functionality identical to pre-redesign (profile, ingredients, generate, results all work)
- [ ] Hero, loading state, and card animations all fire correctly
- [ ] Tested on mobile viewport (375px wide)

---

*Plan generated: 2026-03-15 | Branch: ui-redesign-v3 | Spec: docs/superpowers/specs/2026-03-15-ui-redesign-design.md*
