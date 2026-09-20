# Current request checklist (2026-08-10)

| #   | Item                                                                   | Status                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Backend settings page failing with `SUPABASE_SERVICE_ROLE_KEY` missing | Done — managed backend env rebound, dev server restarted                                                                                                                                                                     |
| 2   | Add / remove therapists from the admin                                 | Done — `createTherapist` server function + **Add therapist** dialog on `/admin/therapists` (delete/hide already existed)                                                                                                     |
| 3   | Real content editing in the page builder (not only move up/down)       | Done — the section settings panel now has a **Text** block (eyebrow, heading, highlighted heading, heading tail, intro paragraph) plus the existing cards / buttons / images / FAQ editors; inline click-to-type still works |
| 4   | Alternating section backgrounds on Services                            | Done — feature rows have a per-row **Dark background with white text** switch. Seeded: Clarity Call (light), Individual Therapy (dark), Couple Therapy (light), Teen/Child Therapy (dark)                                    |
| 5   | 3D logo mark used for the favicon / app icons                          | Done — the 3D mark is trimmed, squared and exported to `favicon.ico`, 16/32/192/512 PNGs and the Apple touch icon; source kept at `src/assets/talk-space-mark-3d.png`                                                        |

## Notes

- The dark/light rhythm on Services is data, not code: any admin can flip a row's
  tone from the page builder without a deployment.
- New therapists are created **hidden**, so they never appear publicly or in
  booking until the profile is completed and switched on.
- The header wordmark still uses the full Talk Space lockup; the 3D mark is used
  for icons only so the mark is not duplicated in the header.
