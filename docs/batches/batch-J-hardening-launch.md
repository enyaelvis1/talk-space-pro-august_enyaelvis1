# Batch J — Hardening, testing, deployment, launch

**Sections:** 20, 21, 22, 23

## Scope

- Security: RLS review pass, secrets audit, rate limits on public endpoints, CSRF on state-changing routes, dependency scan clean.
- Testing: unit (server fns), integration (booking + payment happy paths), E2E (Playwright) for signup → book → pay → confirmation.
- Deployment: production custom domain, DNS + SPF/DKIM/DMARC, backups verified, staging environment.
- Launch: content freeze, redirect map from old WordPress URLs, GA4 + Search Console, handover doc.

## Acceptance

- All E2E green in CI.
- Custom domain live with valid TLS + email deliverability.
- Handover document signed off.
