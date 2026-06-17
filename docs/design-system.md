# Sproutly — Design System

> Derived from the Lovable mockups in `docs/design-references/` plus the brand direction:
> **calm, reassuring greens with warm neutrals**. The visual tone must reassure Maya (the
> Guilty Non-Starter) while feeling credible and evidence-led for Thomas (the Rockery Defender).
> Mobile-first, primary viewport 390px.

> ⚠️ **Scope note:** Some reference screens depict **v2 features** (Survival Confidence Score,
> biodiversity %, seasonal nudges, before/after simulation). Use them for *visual* language only —
> they are **out of v1 scope** (see PRD Non-Goals). Do not build those features from the mockups.

---

## Brand Personality
Editorial, natural, unhurried. Lots of whitespace. One clear action per screen. Plain language,
gentle reassurance, evidence shown calmly (never lectured). Nature photography is a first-class
design element — let it breathe full-bleed on hero/landing.

---

## Color Palette

Approximate values sampled from the mockups — treat as the starting tokens, refine in code.

| Token | Hex (approx) | Usage |
|---|---|---|
| `background` | `#F3EFE7` | Warm cream page canvas — the default background everywhere. Never pure white. |
| `card` | `#FFFFFF` | Floating white cards on the cream canvas. |
| `primary` | `#2D3B26` | Deep forest green — primary buttons, logo badge, dark CTAs, key headings on dark. |
| `primary-foreground` | `#F3EFE7` | Text/icons on the deep green. |
| `accent-sage` | `#7C9A6E` | Muted sage — secondary/hero pill buttons, subtle highlights. |
| `surface-warm` | `#DDD2C2` | Warm tan/taupe — special "feature" cards (comparison, callouts). |
| `foreground` | `#1C1C1A` | Near-black primary text. |
| `muted-foreground` | `#6B6358` | Warm grey-brown — secondary/supporting text. |
| `label` | `#8A7E6E` | Taupe — small uppercase eyebrow labels. |
| `border` | `#E5DFD3` | Hairline borders / dashed dropzone outlines on cream. |

### Status colors (plant/grow states)
| State | Color | Meaning |
|---|---|---|
| Thriving | `#2D3B26` / green dot | Healthy, established |
| Dormant | `#9C9486` / grey dot | Seasonal rest |
| Needs attention | `#C2683F` / terracotta dot | "Check in" |

---

## Typography

| Role | Font | Notes |
|---|---|---|
| Headings | **Serif** (recommended: **Fraunces**, or Lora as a calmer alt) | Editorial, warm, classic. Used for screen titles ("Your garden. Less work. More life.", "Scan your space"). |
| Body & UI | **Montserrat** | All body copy, form fields, buttons, navigation. |
| Eyebrow labels | **Monospace** (recommended: IBM Plex Mono / Roboto Mono) | UPPERCASE, letter-spaced, small, in `label` taupe. E.g. "WHAT HAPPENS NEXT", "OCTOBER NUDGE", "SURVIVAL CONFIDENCE SCORE". |

- Headings: tight leading, normal weight (the serif carries the emphasis, not bold weight).
- Body: comfortable leading, regular weight; secondary text in `muted-foreground`.
- Eyebrow labels: ~11–12px, uppercase, `letter-spacing` ~0.08em.

---

## Components & Patterns

- **Cards:** white, large radius (~`rounded-2xl`, 16–20px), generous padding, very soft or no shadow. A subtle hairline border on cream is enough separation.
- **Dashed dropzones:** dashed `border` outline for upload / empty states ("Tap to take or upload a photo", "Your first photo goes here").
- **Primary button:** full-width, deep forest green, white text, large radius, comfortable height (~52px). One per screen.
- **Pill button (hero):** rounded-full sage button with a circular arrow affordance on the right.
- **Form rows:** white pill/card rows with a small circular leading icon, a tiny taupe label above the value, inline dropdown chevrons (see "Here's what we see").
- **Top bar:** centered leaf + "Sroutly" wordmark, "← Back" left, step counter ("1/4") right, dot progress indicator beneath.
- **Comparison card:** two columns on `surface-warm`, big numeric callout per side, checklist rows beneath, source attribution in small muted text.
- **Status list:** plant rows with thumbnail, common + Latin name, right-aligned status dot + label.

---

## Layout & Spacing
- Mobile-first, **390px** primary viewport; cards span nearly full width with ~16–20px side gutters.
- Vertical rhythm is generous — sections separated by clear whitespace, not dividers where avoidable.
- Hero/landing uses **full-bleed photography** with white serif text overlaid bottom-left.

---

## Implementation Notes (for `/frontend`)
- Build on **Tailwind + shadcn/ui**; map the tokens above to CSS variables / `tailwind.config` theme.
- Load **Montserrat**, the chosen **serif**, and a **monospace** via `next/font`.
- shadcn `Card`, `Button`, `Badge`, `Select` cover most patterns — theme them, don't recreate.
- Keep contrast accessible: verify deep green on cream and taupe labels meet WCAG AA for their sizes.
