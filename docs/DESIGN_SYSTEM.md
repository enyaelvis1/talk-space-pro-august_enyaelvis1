# Talk Space Design System

A Calenira-inspired minimal, editorial design system built on Tailwind v4
semantic tokens. Every page and component must consume these tokens — never
hardcode hex values or ad-hoc spacing.

## Rule 0 — Token-only styling

- Colours: use `bg-*`, `text-*`, `border-*` classes backed by semantic tokens
  (`background`, `foreground`, `primary`, `card`, `muted`, `brand-*`,
  `surface-*`, `accent-terracotta`). Never `bg-white`, `text-black`,
  `bg-[#…]`, or Tailwind palette colours (`text-gray-500`).
- Focus rings: rely on the global `:focus-visible` outline or the shadcn
  `focus-visible:ring-2 ring-ring ring-offset-2` pattern. Do not roll your own.

## Colour tokens

| Token                 | Value     | Use                                                |
| --------------------- | --------- | -------------------------------------------------- |
| `--brand-deep`        | `#2F312C` | Body text, headings, deep surfaces                 |
| `--brand-blue`        | `#81846F` | Sage — decorative surfaces only (fails AA on text) |
| `--brand-blue-deep`   | `#5F6252` | AA-safe text on cream/off-white (links, CTAs)      |
| `--brand-blue-soft`   | `#A4A58F` | Light sage — dividers, disabled surfaces           |
| `--brand-mint`        | `#6E715E` | Olive-gray accent                                  |
| `--surface-page`      | `#F6F2E9` | Global cream background                            |
| `--surface-card`      | `#FCFAF5` | Off-white card surface                             |
| `--surface-cream`     | `#F6F2E9` | Panel background inside cards                      |
| `--surface-peach`     | `#D8D2C6` | Muted taupe divider surface                        |
| `--accent-terracotta` | `#6E715E` | Section-badge / pill CTA colour                    |

Utility aliases: `bg-brand-blue-deep`, `text-brand-deep`, `bg-surface-card`,
`border-surface-peach`, etc.

## Typography

- `--font-sans` (**Inter**) — body copy, UI, controls.
- `--font-display` (**Fraunces**) — hero and section headings via the
  `font-display` utility.
- `--font-mono` (**JetBrains Mono**) — booking / payment references.

Scale (defined in `@layer base`):

| Element | Size / Line-height | Weight |
| ------- | ------------------ | ------ |
| `h1`    | `2.5rem / 1.2`     | 700    |
| `h2`    | `2rem / 1.25`      | 600    |
| `h3`    | `1.5rem / 1.33`    | 600    |
| `h4`    | `1.25rem / 1.4`    | 600    |
| body    | `1rem / 1.625`     | 400    |

Editorial utilities:

- `.display-1` — hero heading (`clamp(2.5rem, 4.5vw + 1rem, 4rem)`, serif).
- `.font-display` — Fraunces on any heading you want editorial.
- `.eyebrow` — 12px uppercase muted label above headings.
- `.section-badge` — Calenira pill: cream background, terracotta uppercase text.
- `.ref-mono` — monospaced reference chips.

## Spacing & layout

Tokens (do not hardcode `py-24`, `max-w-6xl`, etc.):

| Token                  | Value                        | Utility                            |
| ---------------------- | ---------------------------- | ---------------------------------- |
| `--space-section-y`    | `clamp(3rem, 6vw, 5rem)`     | `.section-y`                       |
| `--space-section-y-lg` | `clamp(4.5rem, 9vw, 7.5rem)` | `.section-y-lg`                    |
| `--space-stack`        | `1.5rem`                     | default gap between stacked blocks |
| `--container-narrow`   | `44rem`                      | `.container-narrow` — forms, prose |
| `--container-content`  | `64rem`                      | `.container-content` — marketing   |
| `--container-wide`     | `80rem`                      | `.container-wide` — hero, gallery  |

### `<Section>` primitive

`src/components/site/Section.tsx` bundles vertical rhythm + container width

- surface. Prefer it over ad-hoc wrappers:

```tsx
<Section spacing="lg" container="content" surface="page">
  <SectionBadge>Services</SectionBadge>
  <h2 className="font-display mt-4 text-4xl">Care built around you</h2>
  {/* … */}
</Section>
```

Props: `spacing` (`default | lg | none`), `container`
(`narrow | content | wide | none`), `surface`
(`page | card | cream | none`), `as` (`section | div | article | aside`).

## Radii, shadows, surfaces

- `rounded-2xl` / `rounded-3xl` on cards, hero frames, gallery tiles.
- `.shadow-soft-warm` — the warm botanical drop shadow for elevated cards.
- `.card-warm` — off-white card surface preset (border + radius + shadow).
- `.surface-cream-panel` — inline cream sub-panel.

## Buttons

Use the shadcn `Button` component with a variant + size. Do not restyle
buttons inline.

| Variant       | Purpose                                               |
| ------------- | ----------------------------------------------------- |
| `default`     | Primary sage CTA (deep sage on cream)                 |
| `secondary`   | Muted sage CTA                                        |
| `outline`     | Neutral outline on card surfaces                      |
| `ghost`       | Text-only, hover fill                                 |
| `link`        | Inline text link (`text-primary`, underline on hover) |
| `terracotta`  | Calenira pill CTA (olive-gray)                        |
| `pillOutline` | Pill CTA outline pair for terracotta                  |

| Size        | Purpose                                       |
| ----------- | --------------------------------------------- |
| `default`   | Standard 36px control                         |
| `sm` / `lg` | Compact / prominent variants                  |
| `icon`      | 36×36 icon-only (**always** add `aria-label`) |
| `pill`      | 44px pill — the Calenira default CTA          |
| `pillLg`    | 48px pill — hero CTA                          |

```tsx
<Button variant="terracotta" size="pillLg" asChild>
  <Link to="/booking">Book a session</Link>
</Button>
```

## Motion

- Durations: `--duration-fast (150ms)`, `--duration-base (200ms)`,
  `--duration-slow (250ms)`.
- Easing: `--ease-standard` (`cubic-bezier(0.2, 0.8, 0.2, 1)`).
- Scroll-in animation: wrap a block in `<Reveal>` — respects
  `prefers-reduced-motion`.

## Component states

Use [docs/COMPONENT_STATES.md](COMPONENT_STATES.md) as the canonical matrix
for hover, focus, pressed, loading, empty, error, and selected states across
buttons, inputs, cards, navigation, and content blocks.

## Accessibility guarantees

- Every interactive element inherits a 2px `--ring` focus outline with 2px
  offset (WCAG 2.4.11).
- Text uses `--brand-blue-deep` (5.6:1 on cream) or `--foreground` for
  body copy — never the lighter `--brand-blue` sage.
- Icon-only buttons must ship an `aria-label`.

## Page composition checklist

1. Wrap page content in one `<main>` (the layout provides it).
2. Compose sections with `<Section>` — never bare `<section>` + manual `py-*`.
3. Headings use `font-display` for editorial impact; body stays Inter.
4. CTAs are `Button` variants — pill/terracotta on marketing surfaces.
5. Elevated content sits on `.card-warm`; inline panels on `.surface-cream-panel`.
6. Wrap groups of content-heavy blocks in `<Reveal>` for on-scroll entrance.
