# Design QA Checklist

Lightweight visual gate before merging a milestone into `develop` or promoting
`develop` to `main`. Goal: catch visual regressions early without turning QA
into a bottleneck.

## How to run it

1. Start the dev server and log in with a test account when the milestone
   touches authenticated flows.
2. For every route in the milestone's **Required screenshots** table below,
   capture three viewports:
   - Mobile — 390 x 844
   - Tablet — 820 x 1180
   - Desktop — 1280 x 900
3. Save under `docs/qa/<milestone-slug>/<route>-<viewport>.png`.
4. Walk through the **Universal checks** for each screenshot. Note failures
   in the pull request description with the screenshot path.
5. Attach the screenshot set to the pull request or link the folder.

Automate capture with the existing Playwright audit script
(`/tmp/browser/audit/s.py`) — copy new routes into the `PAGES` list, run it,
then move outputs into `docs/qa/<milestone-slug>/`.

## Universal checks (every screenshot)

Layout

- [ ] No horizontal scroll at 390 px.
- [ ] Header pill visible, uncrowded; hamburger appears below 1024 px only.
- [ ] Floating dock or mobile bottom nav present on public routes, hidden on
      admin / auth / booking routes.
- [ ] Section vertical rhythm uses `section-y` / `section-y-lg` — no bespoke
      `py-*` values on top-level sections.
- [ ] Container width matches intent (`container-narrow` / `container-content`
      / `container-wide`).

Type and colour

- [ ] Display headings use Fraunces; body uses the system sans stack.
- [ ] No hardcoded hex values or `text-white` / `bg-black` in modified files
      (grep the diff).
- [ ] Links on cream surfaces use `text-brand-blue-deep`, not `text-brand-blue`.
- [ ] Focus ring visible on buttons, inputs, and links (2 px, deep sage,
      2 px offset).

Content and state

- [ ] Loading, empty, and error states render without layout shift.
- [ ] Long strings (names, service titles, prices) truncate or wrap, never
      overflow the pill / card.
- [ ] Images have alt text and use `OptimizedImage` where available.
- [ ] Meta title and description are route-specific (not the root defaults).

Motion

- [ ] `Reveal` animations fire once per section, no jank on scroll.
- [ ] `AutoPlayGallery` marquee runs smoothly (no stutter, no reset flash).
- [ ] `prefers-reduced-motion` still renders content — no blank sections.

Accessibility

- [ ] Tab order follows visual order.
- [ ] All interactive elements have an accessible name (`aria-label` or
      visible text).
- [ ] Colour contrast meets WCAG AA (deep sage on cream, charcoal on cream,
      white on terracotta).

## Required screenshots per milestone

Only public and admin-facing surfaces need screenshots. Backend-only
milestones (migrations, edge functions, config) skip the visual gate — note
"N/A — no visual surface" in the pull request.

| Milestone                            | Routes to capture                                                    |
| ------------------------------------ | -------------------------------------------------------------------- |
| 03. Brand/design                     | `/`, `/about`                                                        |
| 04. Public shell                     | `/`, `/404`, any layout under `_authenticated` shell                 |
| 05. Public pages                     | `/services`, `/therapists`, `/pricing`, `/contact`, `/blog`, `/faqs` |
| 06. CMS                              | `/blog`, `/blog/<slug>`, `/admin/content`                            |
| 07. Authentication                   | `/login`, `/reset-password`, `/account`                              |
| 08. Availability                     | `/admin/availability`                                                |
| 09. Booking                          | `/book` (each step), `/book/confirmation`                            |
| 10. Client management                | `/admin/clients`, `/admin/clients/<id>`                              |
| 11. Forms                            | `/book` intake form, `/contact` form                                 |
| 12. Paystack                         | `/book/payment` (Paystack path), receipt state                       |
| 13. Bank transfer                    | `/book/payment` (bank path), pending-verification state              |
| 14. Google                           | `/account/integrations`, admin Google connect view                   |
| 15. Email                            | Rendered email templates (light + dark client)                       |
| 16. Contact/WhatsApp                 | Floating dock, `/contact`, mobile bottom nav                         |
| 17. Admin operations                 | `/admin`, `/admin/appointments`, `/admin/progress`                   |
| 19. SEO/performance/a11y             | `/`, `/services`, `/blog/<slug>` — plus Lighthouse                   |
| 21. Testing/QA                       | Full public + admin sweep before release                             |
| 22. Deployment                       | Post-deploy smoke of `/`, `/book`, `/admin` on preview URL           |
| 25. Calenira-inspired design refresh | `/`, `/services`, `/therapists`, `/pricing`, `/contact`, `/blog`     |

## Pull request template snippet

Paste into the PR description for any milestone with a visual surface:

```
### Design QA
- Milestone: <number and name>
- Screenshots: docs/qa/<milestone-slug>/
- Universal checks: pass / fail (link issues below)
- Notable regressions: none / <list>
- Reduced-motion + dark-mode spot check: pass / fail
```

## When to skip

- Backend-only migrations, edge functions, cron, or infra changes.
- Copy-only tweaks that do not change layout or tokens (still spot-check the
  affected route on one viewport).
- Dependency bumps with no runtime output diff (verify build + typecheck
  instead).

Anything else — including "small" CSS tweaks — runs the full checklist.
