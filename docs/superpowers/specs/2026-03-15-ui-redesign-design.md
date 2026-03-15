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

  /* Brand colours (unchanged) */
  --earth:           #2D1A0E;   /* deepened from #3D2B1F */
  --earth-mid:       #4A2E1A;
  --terracotta:      #C4622D;
  --terracotta-light:#E8835A;
  --sage:            #5A7A4E;   /* deepened from #7A8C6E */
  --sage-chip:       #D4E4CF;
  --gold:            #D4A847;
  --muted:           #8A7968;

  /* Elevation system */
  --shadow-float: 0 12px 48px rgba(45,26,14,0.13), 0 3px 12px rgba(45,26,14,0.08);
  --shadow-small: 0 4px 16px rgba(45,26,14,0.10), 0 1px 4px rgba(45,26,14,0.06);
  --shadow-btn:   0 8px 28px rgba(45,26,14,0.22), 0 2px 8px rgba(45,26,14,0.12);

  /* Chip gradient */
  --chip-bg: linear-gradient(135deg, #E8EDE4, #D4E4CF);
}
```

**Typography:** Unchanged — Playfair Display (display/serif) + DM Sans (body). Font weights pushed heavier: headings use `font-weight: 800`, labels use `font-weight: 600`.

---

## 2. Hero Section

**Treatment:** Full-bleed gradient (E-style) + stacked-depth input card (F-style)

### Hero banner
- Background: `linear-gradient(150deg, #1A0A04 0%, #7A2D10 35%, #C4622D 65%, #D4A847 100%)`
- SVG fractal noise texture overlay at 7% opacity (existing pattern, kept)
- Three decorative food emojis (🍲, 🥗, 🍳) at 7–8% opacity, rotated, `pointer-events: none`
- Logo: frosted glass pill — `background: rgba(255,255,255,0.1)`, `backdrop-filter: blur(6px)`, `border: 1px solid rgba(255,255,255,0.18)`, gradient icon box inside
- Headline: Playfair Display 36px / 800 weight, white, `letter-spacing: -1.5px`, `text-shadow: 0 2px 20px rgba(0,0,0,0.2)`
  - Copy: *"Turn what you have into something **beautiful.**"* — `<em>` in `var(--gold)`
- Sub-copy: 14px DM Sans, `rgba(255,255,255,0.72)`, max-width 280px centred

### Stacked input card
- Wrapper `margin-top: -52px` to overlap the hero
- Two ghost layers via `::before` / `::after`: rotated `1.8deg` and `-1.2deg`, `background: linear-gradient(135deg, rgba(196,98,45,0.10), rgba(212,168,71,0.07))`, `border: 1px solid rgba(196,98,45,0.15)`, `border-radius: 22px`
- Main card: `background: white`, `border-radius: 22px`, `box-shadow: var(--shadow-float)`, `z-index: 2`
- Section labels inside card: 11px / 600 weight, uppercase, `letter-spacing: 1.5px`, `color: var(--terracotta)` (replaces muted grey)

---

## 3. Profile Strip

Moves inside the input card, below a "Your profile" terracotta label, above the ingredient input. Separated from the ingredient section by a `1px solid #F0EAE2` divider.

Pills: `background: #FFF8F2`, `border: 1.5px solid #EDE8E0`, `border-radius: 100px`. No visual change beyond the warmer background tint.

---

## 4. Health Conditions Card

- Lifted to `box-shadow: var(--shadow-float)` (was flat)
- Section label colour: `var(--terracotta)` (was muted)
- Health condition buttons on selected: `background: #FDE8E8`, `border-color: var(--terracotta)` — unchanged
- Disclaimer box: unchanged

---

## 5. Ingredient Input & Tags

### Input field
- Background: `#FFF8F2` (warmer tint)
- Focus ring: `box-shadow: 0 0 0 4px rgba(196,98,45,0.07)` (slightly wider)
- Border radius: `14px` (up from `12px`)

### Add button
- Adds `box-shadow: 0 4px 12px rgba(196,98,45,0.35)` for lift

### Ingredient tags
- Background: `linear-gradient(135deg, #E8EDE4, #D4E4CF)` (gradient instead of flat)
- `box-shadow: 0 2px 6px rgba(45,26,14,0.08)` for slight lift
- Pop-in animation: `cubic-bezier(0.34, 1.56, 0.64, 1)` spring bounce (existing `tagPop` keyframe, updated easing)

### Quick-add pills
- Hover: `background: linear-gradient(135deg, #E8EDE4, #D4E4CF)` (matches chip gradient)

---

## 6. Generate Button

The most important microinteraction in the app — must feel like a ritual.

```css
.generate-btn {
  background: linear-gradient(135deg, #2D1A0E, #4A2E1A);
  border-radius: 18px;
  padding: 20px 32px;
  font-size: 20px;
  box-shadow: var(--shadow-btn);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  overflow: hidden;
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
  opacity: 0; transition: opacity 0.3s;
}
.generate-btn:hover { transform: translateY(-3px) scale(1.01); }
.generate-btn:hover::before { left: 150%; }   /* sweep fires */
.generate-btn:hover::after  { opacity: 1; }   /* glow appears */
.generate-btn:active { transform: scale(0.98); transition: all 0.1s; } /* spring-back */
```

The ✦ spark icon rotates `20deg` and scales `1.2×` on hover via a child span transition.

---

## 7. Loading State

Replaces the single spinner with:

1. **Skeleton cards** — two placeholder cards with shimmer animation matching the exact shape of meal cards (header block + body lines + chip row). Uses `background-position` sweep animation. Reduces perceived wait time.

2. **Dual concentric rings** — outer ring `border-top-color: var(--terracotta)` spinning forward; inner ring `border-top-color: var(--gold)` spinning in reverse at `1.4s`. More visually dynamic than a single ring.

3. **Aurora blob accents** — three `position: absolute` radial gradient blobs (terracotta, gold, sage) with `filter: blur(28px)` and a slow `pulse` keyframe (`scale 1→1.2`, `3s alternate`). Adds life without distraction.

4. **Copy:** `"Finding your meals…"` / `"Turning your ingredients into something beautiful"` — italic Playfair Display.

---

## 8. Meal Result Cards

### Card shell
- `border-radius: 24px` (up from `20px`)
- `box-shadow: var(--shadow-float)` (two-layer — replaces single soft shadow)
- Hover: `translateY(-3px)`, shadow deepens to `0 20px 60px rgba(45,26,14,0.16), 0 4px 16px rgba(45,26,14,0.10)`

### Gradient header
- Three rotating styles unchanged (terracotta, sage, earth)
- **Frosted glass emoji box** replaces plain emoji:
  ```css
  width: 58px; height: 58px;
  background: rgba(255,255,255,0.18);
  backdrop-filter: blur(8px);
  border: 1.5px solid rgba(255,255,255,0.28);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  ```
- Time/difficulty badges: `backdrop-filter: blur(4px)`, `border: 1px solid rgba(255,255,255,0.25)` (glassmorphism)
- Meal name font-weight: `700` (up from `400`)

### Body
- Affirmation: unchanged styling, adds slide-in animation on reveal
- Description: unchanged
- Section labels: `color: var(--muted)`, `font-weight: 600` (up from `500`)

### Ingredient chips
- `background: linear-gradient(135deg, #E8EDE4, #D4E4CF)` (gradient)
- `box-shadow: 0 1px 4px rgba(45,26,14,0.08)`
- Quantity badge: unchanged

### Nutrition grid
- Item background: `linear-gradient(135deg, #FFF8F2, #FFF3E8)` (warm tint, replaces flat `--cream`)
- `border: 1px solid #F0EAE2`
- `border-radius: 10px` (up from `8px`)

### Step numbers
- Background: `linear-gradient(135deg, var(--terracotta), var(--terracotta-light))`
- `box-shadow: 0 2px 6px rgba(196,98,45,0.3)`

### Steps toggle button
- Hover: `background: #FFF4EE`, `color: var(--terracotta)`

### Rating buttons
- Background: `#FFF8F2` (warmer)
- Hover: `transform: scale(1.2)`, `border-color: var(--terracotta)`

### Share button
- `box-shadow: 0 4px 16px rgba(196,98,45,0.28)`
- Hover: `translateY(-1px)`, shadow deepens

---

## 9. Card Reveal Animation Sequence

The aha moment — triggered when AI results arrive. Total choreography: ~0.8s.

| Element | Animation | Easing | Delay |
|---|---|---|---|
| Card 1 shell | `opacity 0→1, translateY 32px→0, scale 0.97→1` | `cubic-bezier(0.22,1,0.36,1)` | 50ms |
| Card 2 shell | same | same | 180ms |
| Card 3 shell | same | same | 310ms |
| Gradient headers | `opacity 0→1, scale 1.04→1` | same | card delay + 50ms |
| Emoji boxes | `opacity 0→1, scale 0.5→1` (bounce) | `cubic-bezier(0.34,1.56,0.64,1)` | card delay + 150ms |
| Affirmations | `opacity 0→1, translateX -12px→0` | `ease` | card delay + 250ms |
| Ingredient chips | `opacity 0→1, scale 0.6→1` (bounce each) | `cubic-bezier(0.34,1.56,0.64,1)` | staggered 70ms apart |

---

## 10. Stretch Card

- Lifts to `box-shadow: var(--shadow-float)`
- Flat `background: linear-gradient(135deg, #FEF3E2, #FDF8F0)` replaced with white card + gold gradient header band:
  - Header band: `background: linear-gradient(135deg, #D4A847, #E8C56A)`, contains frosted "✦ Stretch" pill label + title
  - Body: white, `padding: 16px 20px`
- Stretch ingredient chip: `background: linear-gradient(135deg, #FEF8E8, #FDEECA)`, `box-shadow: 0 2px 8px rgba(212,168,71,0.15)`

---

## 11. Confidence Banner

- `box-shadow: var(--shadow-float)`
- Gold radial glow behind the number: `position: absolute` radial gradient `rgba(212,168,71,0.2)`
- Number: adds `text-shadow: 0 0 30px rgba(212,168,71,0.3)` glow

---

## 12. Feedback Card

- `box-shadow: var(--shadow-float)` (was flat)
- Thumb buttons: `background: #FFF8F2`, `box-shadow: var(--shadow-small)`
- Thumb hover: `box-shadow: 0 6px 20px rgba(196,98,45,0.18)`

---

## 13. Email Signup Card

- Gradient unchanged: `linear-gradient(135deg, #3D2B1F, #5C3D2A)`
- Adds `box-shadow: var(--shadow-float)`
- Adds terracotta radial glow in bottom-left corner (decorative)
- Submit button: adds `box-shadow: 0 4px 14px rgba(196,98,45,0.35)`

---

## 14. Share Nudge Card

- Gradient unchanged: `linear-gradient(135deg, #5A7A4E, #7A8C6E)`
  (deepened slightly: `#3D6B30 → #5A7A4E`)
- Adds `box-shadow: var(--shadow-float)`
- Sage radial glow in top-right corner (decorative)
- WhatsApp button: `box-shadow: 0 4px 16px rgba(0,0,0,0.15)`

---

## 15. Try Again Button

- `border-radius: 14px` (up from `12px`)
- `background: transparent`, border `1.5px solid #EDE8E0`
- Hover: `border-color: var(--terracotta)`, `color: var(--terracotta)` — unchanged behaviour

---

## 16. Footer

- Text colour: `#C5BDB2` — unchanged
- Links: `color: var(--terracotta)` — unchanged

---

## 17. Implementation Constraints

1. **Single file** — all changes live in `index.html`. No new files created.
2. **JS untouched** — zero changes to any `<script>` block or `window.*` functions.
3. **All `onclick` handlers preserved** — no HTML restructuring that would break event listeners.
4. **Validation rule** — after every edit: braces balanced, backticks even, all onclick functions on `window.*`, `node --check` passes.
5. **No external dependencies added** — no new CDN links. `html2canvas` stays. Google Fonts stays.
6. **Performance** — all new animations use `transform` and `opacity` only (GPU-composited, no layout thrash). Aurora blobs use `filter: blur()` which is GPU-accelerated on all modern browsers.
7. **Mobile** — all existing `@media` breakpoints preserved. New shadow values and border-radii are unitless and scale correctly.

---

## 18. Sections Not Changed

The following are **functionally and visually identical** to current implementation (no redesign needed):
- Share modal overlay
- Share card capture (off-screen image for html2canvas)
- Health condition grid layout and button states
- Privacy / Terms modal content
- Rate limiting UI
- Error state card

---

## Summary of Visual Delta

| Property | Before | After |
|---|---|---|
| Background | `#F7F3EC` flat | `#FFF8F2` warmer, same flat |
| Card shadows | Single soft shadow | Two-layer float shadow system |
| Card border-radius | `20px` | `22–24px` |
| Hero | Logo + tagline | Full-bleed gradient, headline, stacked card |
| Ingredient chips | Flat `#E8EDE4` | Gradient `#E8EDE4 → #D4E4CF` |
| Nutrition items | Flat `--cream` | Warm gradient tint |
| Generate button | Flat dark | Shimmer sweep + glow + spring-back |
| Loading | Single spinner | Skeleton cards + dual rings + aurora blobs |
| Meal card header | Emoji centred | Frosted glass emoji box, left-aligned with name |
| Meal card reveal | Simple fade | Staggered spring choreography (0.8s) |
| Step numbers | Flat terracotta | Gradient + shadow |
| Stretch card | Flat gradient card | White float + gold band header |
| Confidence banner | Flat dark | Float shadow + gold glow |
| Feedback/Email/Nudge cards | Flat | Float shadow + radial glow accent |
