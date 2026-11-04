# Motion & interaction system

A single, documented system keeps every animation consistent and cheap.

## Design tokens — `src/lib/motion.ts`

| Token | Value | Used for |
| --- | --- | --- |
| `EASE` | `cubic-bezier(0.22, 1, 0.36, 1)` | Primary ease for reveals, hovers, transitions |
| `EASE_IN_OUT` | `cubic-bezier(0.4, 0, 0.2, 1)` | Exits and small UI responses |
| `DURATION.fast` | 220 ms | Hover, toasts, tabs, copy feedback |
| `DURATION.base` | 500 ms | Scroll reveals, cards, lightbox |
| `DURATION.slow` | 750 ms | Large section transitions |

Only `transform` and `opacity` are animated, so animation stays on the
compositor and cannot cause layout shift.

## Primitives

| Component | Purpose | Guardrails |
| --- | --- | --- |
| `Reveal` / `Stagger` / `StaggerItem` | Scroll-triggered entrance | Fires once, 70 px viewport margin |
| `TextReveal` | Word-by-word headline reveal | Same DOM in both motion modes; `aria-label` carries the full sentence |
| `Magnetic` | CTA drifts ~7 px toward pointer | ≥1024 px **and** fine pointer **and** motion allowed |
| `TiltCard` | Max 5° tilt + pointer glow | ≥1280 px, desktop only |
| `ParallaxImage` | ±30 px decorative background drift | Clipped container, disabled under reduced motion |
| `Counter` | Animated numbers | Fires when in view, once |
| `ToastProvider` / `useToast` | Real submission feedback | `aria-live="polite"`, max 3, dismissible |
| `CopyButton` | Clipboard with confirmation | Never inside a link; `preventDefault` + stopPropagation; legacy execCommand fallback |
| `Lightbox` | Accessible image viewer | `role="dialog"`, focus trap, Escape/arrows, scroll lock, focus restored |
| `MotionProvider` | Global policy | `MotionConfig reducedMotion="user"` |

## Reduced motion

Three layers of protection:

1. `MotionConfig reducedMotion="user"` — framer-motion skips transform/opacity animation.
2. `usePrefersReducedMotion()` (`useSyncExternalStore`, server snapshot `false`) — components drop hover/tilt/parallax entirely.
3. CSS `@media (prefers-reduced-motion: reduce)` — collapses any remaining CSS animation/transition to 0.01 ms and disables smooth scrolling.

Content is never left hidden: reveals render their final state instead of
waiting for an animation that will not run.

## Hydration safety

Any media-query-dependent rendering reads through `useSyncExternalStore` with a
server snapshot of `false`, and components keep an identical element tree in
both modes. This removed a real React #418 hydration mismatch found during
testing.

## Touch devices

Magnetic tilt and pointer glow are disabled below 1024 px or on coarse
pointers, so mobile users never meet a control that only responds to hover.
Tap targets are ≥40 px (verified at 48 px in the mobile drawer).

## Route loading states

`loading.tsx` skeletons exist for `/services`, `/specialties`, `/insights`,
`/who-we-serve`, `/faq`, `/results`, `/our-process`, `/about`, `/contact`.
They are static markup — no client JavaScript — and expose
`role="status"` with screen-reader text.

## Testing

```bash
npm run build && npm run start &
BASE_URL=http://127.0.0.1:3000 npm run test:browser       # 67 checks
BASE_URL=http://127.0.0.1:3000 npm run test:interactions  # 17 checks
```

The interaction suite covers reduced motion, copy feedback, toast live regions,
lightbox keyboard handling, skip link, scroll progress, back-to-top, touch tap
targets and service rendering.


---

## Theme, typography and accessibility controls

`ThemeProvider` (`src/components/theme/theme-provider.tsx`) manages four
preferences, persisted in `localStorage` under `kmb-prefs` and applied as
attributes on `<html>`:

| Preference | Attribute | Effect |
| --- | --- | --- |
| Theme | `.dark` class + `color-scheme` | Overrides the semantic colour tokens |
| Text size | `data-textsize` | `large` = 112.5%, `xlarge` = 125% |
| Contrast | `data-contrast` | Raises text and border contrast |
| Motion | `data-motion` | `reduced` forces all animation to ~0 ms |

A tiny inline script in `<head>` applies the saved theme before first paint, so
there is no flash of the wrong theme. `suppressHydrationWarning` on `<html>` is
required because that class is set outside React.

The **Accessibility & display** panel exposes all four controls plus a reset.
It is a labelled `role="dialog"`, closes on Escape, and is rendered through
`Portal` because the sticky header's `backdrop-filter` would otherwise become
the containing block for `position: fixed`.

## Colour theming model

- `--color-surface` — page and card background (white / deep navy).
- `--color-night`, `--color-night-soft` — intentional dark panels; these never
  invert, so brand sections stay dark in both themes.
- `--color-ink-*` — text ramp; inverts to light values under `.dark`.
- `--color-mist-*` — neutral surfaces and borders; becomes a dark ramp.

Because Tailwind v4 utilities resolve to these CSS variables, existing classes
such as `bg-surface`, `text-ink-900` and `border-mist-200` adapt automatically
without duplicating every component.

## Additional interaction primitives

| Component | Behaviour |
| --- | --- |
| `Typewriter` | Types and deletes phrases; reserves width with a hidden longest phrase so nothing reflows; disabled under reduced motion |
| `StickySteps` | Pinned visual with scroll-driven active step on desktop; plain stacked list on mobile |
| `BeforeAfter` | Draggable comparison slider plus a real range input for keyboard and screen readers |
| `CardShuffle` | Reorders a subset of cards with layout animation and a labelled button |
| `TestimonialsCarousel` | Tab-driven, auto-advancing, pause on hover/focus, `aria-live` quote region |
| `MapEmbed` | Google Map loads only after the visitor opts in — no third-party requests on first paint |
| `Portal` | Renders overlays into `<body>` so backdrop-filter ancestors cannot clip them |

## Grid overflow rule

`.shell .grid > *, .shell.grid > *` sets `min-width: 0`. Grid items default to
`min-width: auto`, which lets long words push a column past its track and create
horizontal scrolling on narrow screens. Tables that genuinely need width live
inside `overflow-x-auto` containers, so this is safe.


---

## Automatic interactions (no user action required)

Interactions that previously required a click now run on their own, with hover
and keyboard focus pausing them so a visitor is never fighting the animation:

| Component | Automatic behaviour | Pause / override |
| --- | --- | --- |
| `HeroCanvas` | Drifting claim-flow nodes that connect and brighten near the pointer | Pauses off-screen and when the tab is hidden; single static frame under reduced motion |
| `HeroPanel` | Claims advance through four stages on a 1.7 s cadence | Interval cleared under reduced motion |
| `CardShuffle` | Rotates the visible set every 4.2 s | Hover/focus pauses; "Show another set of priorities" advances manually |
| `BeforeAfter` | Divider sweeps between 24 % and 78 % | First pointer/keyboard interaction stops the sweep permanently |
| `TestimonialsCarousel` | Advances every 7 s | Hover, focus or a tab selection pauses |

## Hero composition

The hero uses **no photograph**. Its visual interest comes from:

1. `HeroCanvas` — a canvas layer of ~14–46 nodes whose count scales with
   viewport area, rendered at a device-pixel-ratio capped at 2.
2. An animated gradient orb and a masked grid.
3. `HeroPanel` — a live "claim flow" card showing the four stages a claim
   passes through, with illustrative metrics clearly labelled as such.

Rationale: a stock photograph says nothing about revenue cycle management,
whereas the canvas + panel communicate the product concept immediately and cost
far less bandwidth than a large image.
