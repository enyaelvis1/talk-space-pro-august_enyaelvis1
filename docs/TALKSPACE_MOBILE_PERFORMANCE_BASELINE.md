# Talk Space mobile performance baseline and test protocol

Status: implementation protocol ready; staging measurements required.

The app already uses responsive image transformations, eager loading for the
primary visible image, and lazy loading for below-fold imagery. This document
defines the comparable measurement needed before claiming a performance fix.

## Pages and viewports

- Home, pricing, therapists, journal listing, and booking.
- 390 × 844 and 360 × 800 mobile viewports, plus a 1280px desktop control.
- Three cold-load runs per page on the same staging build and network profile;
  record the median rather than the best run.

## Record for each run

- FCP, LCP, TBT, CLS, total transferred bytes, image request count, and largest
  delivered image dimensions/bytes.
- Whether the primary image is eager/high priority and below-fold images are
  lazy.
- Layout shifts, crop/quality regressions, custom CMS image URLs, and cache
  headers.

## Acceptance gate

The target values must be agreed by the product owner before UAT. A change is
accepted only when the median improves against the same-build baseline without
breaking 360/390px layout, image crop, accessibility, or uploaded/custom media
URLs. Do not infer performance success from the existence of an image component
alone.
