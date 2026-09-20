# Release process

This repository uses `develop` as the integration branch and `main` as the production branch.

## Normal flow

1. Create a feature branch from `develop`.
2. Implement one focused change set.
3. Run lint, tests, and build locally.
4. Open a pull request into `develop`.
5. After release approval, open a separate pull request from `develop` into `main`.

## Release verification

- Confirm `develop` is green.
- Review the scope against the implementation checklist.
- Re-run `npm run lint`, `npm test`, and `npm run build`.
- Check the diff for unrelated files, secrets, or accidental lockfile churn.
- Capture any known baseline failures before promotion.

## Changelog

- Keep user-facing release notes in the pull request description and the repository changelog.
- Record significant changes, migrations, and manual verification notes in the release PR.

## Emergency rollback

- Prefer reverting the release commit or PR over rewriting published history.
- Keep rollback notes alongside the release description so the next on-call pass can recover quickly.
