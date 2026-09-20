# Component and interaction states

This document records the standard state model for Talk Space UI components.
Use it as the shared reference when building new screens, reviewing PRs, or
auditing design changes.

## Core interaction states

All interactive controls should support these states where applicable:

- Default
- Hover
- Focus visible
- Active / pressed
- Disabled
- Loading / pending
- Selected / current
- Error / invalid
- Read-only

## State rules

- Hover should deepen contrast slightly or raise elevation, never shift layout.
- Focus visible must always use the shared ring treatment from the design
  system.
- Active state should feel tactile, usually with a short scale or shadow
  change.
- Disabled controls must remain legible but visibly inert.
- Loading controls should preserve width and replace only the label or icon
  content.
- Selected state should be unmistakable on both desktop and mobile.
- Error state should pair colour with copy, not colour alone.
- Read-only content should look interactive only if it truly is interactive.

## Component matrix

| Component               | Default                                | Hover / focus                      | Active / pressed                  | Disabled / loading                          | Selected / error                           |
| ----------------------- | -------------------------------------- | ---------------------------------- | --------------------------------- | ------------------------------------------- | ------------------------------------------ |
| Button                  | Primary or secondary token variant     | Gentle lift or colour shift        | Subtle press-in                   | Spinner, same width, disabled opacity       | N/A                                        |
| Link                    | Brand-safe text link                   | Underline or colour shift          | Slight opacity change             | N/A                                         | Current page state may use stronger weight |
| Input / textarea        | Neutral border, clear label            | Border emphasis on focus           | N/A                               | Disabled fill and muted text                | Error border + message                     |
| Select / dropdown       | Compact control with caret             | Focus ring and border lift         | Menu open state                   | Disabled opacity                            | Selected option highlighted in menu        |
| Card / tile             | Soft border, warm surface, shadow rest | Shadow/elevation increase          | Small scale or shadow compression | Skeleton or muted overlay                   | Selected card gets stronger border or tint |
| Navigation item         | Quiet text and icon                    | Colour shift                       | N/A                               | Disabled only when the route is unavailable | Current route gets active tint             |
| Badge / pill            | Status colour token                    | Optional hover only when clickable | N/A                               | N/A                                         | Current filter or chosen pill stays filled |
| Skeleton                | Animated placeholder                   | N/A                                | N/A                               | Use for loading only                        | Replace with real content when ready       |
| Toast / alert           | Clear icon + message                   | Dismiss affordance if applicable   | Dismiss on action                 | Timeout or manual dismissal                 | Error / success / info treatment           |
| Gallery / carousel item | Visible label and image                | Hover motion only if desktop       | Tap/click opens detail            | Pause or freeze during loading              | Current slide gets stronger indicator      |

## Page-level states

### Loading

- Preserve page structure with skeletons or lightweight placeholders.
- Keep headings and containers in place so the layout does not jump.
- Prefer optimistic previews only when data is already known locally.

### Empty

- Explain why the area is empty.
- Offer one obvious next step.
- Avoid decorative emptiness that looks like a broken screen.

### Error

- Say what failed in plain language.
- Keep the error visible inside the affected region.
- Offer a retry action or a support path when recovery is possible.

### Success

- Confirm the completed action briefly.
- Return the user to the content flow quickly.
- Avoid overly large success banners for small actions.

## Motion guidance

- Hover motion should be subtle and quick.
- Loading indicators should communicate activity without dominating the page.
- Reveal animations are for section entrances, not for critical controls.
- Respect `prefers-reduced-motion` everywhere.

## Accessibility checklist

- Every interactive element needs a visible or programmatic label.
- Focus states must remain visible on cream, white, and darker surfaces.
- Error text must be readable without relying on colour alone.
- Selected and current states should be announced clearly to assistive tech.

## Review rule

If a component introduces a new state, document it here before shipping the
feature. If the state changes the public experience, update the design system
and the relevant checklist together.
