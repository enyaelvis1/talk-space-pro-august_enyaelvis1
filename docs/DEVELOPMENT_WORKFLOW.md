# Development workflow

This repository uses a feature-branch workflow coordinated through `develop`.

## Branches

| Branch                         | Purpose                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| `main`                         | Production branch. Keep it deployable.                     |
| `develop`                      | Integration branch where completed feature work is merged. |
| `feature/<batch>-<short-name>` | One implementation or focused change.                      |

Feature branches start from `develop` and are merged back into `develop` by pull request. When a release is approved, open a separate pull request from `develop` to `main`.

Do not force-push or rewrite commits that have already been pushed. Keep commits small and scoped to one implementation. If the worktree already contains user changes, do not include them in an unrelated implementation commit.

The only promotion path is `feature/*` to `develop` through a reviewed pull request, followed by staging/UAT validation, then a separate approved release pull request from `develop` to `main`. Feature branches must never be merged directly into `main`.

Credentialed UAT values must be supplied through secure runtime environment variables or CI secrets. Do not place passwords, service keys, or other credentials in `.env` files, commits, screenshots, or test artifacts.

## Commit messages

Use the Conventional Commits format:

```text
<type>: <imperative summary>
```

Use `feat` for new functionality, `fix` for corrections, `docs` for documentation, `chore` for maintenance or generated files, and `refactor`, `test`, `perf`, `ci`, or `build` when those categories are more precise. Keep the summary concise and imperative.

## Implementation handoff

At the end of every implementation, report:

- What changed and the relevant files.
- Automated checks run and whether they passed.
- A **What to test** section containing manual checks the user can perform.
- Known baseline failures, blockers, or external integrations that were not exercised.

## Pull-request checklist

Before opening a pull request:

1. Confirm the feature branch is pushed and up to date.
2. Run the relevant lint, type/build, and test commands.
3. Review the diff for unrelated files or secrets.
4. Complete the manual checks in the implementation handoff.
5. Open the feature → `develop` pull request with a summary, test evidence, screenshots where useful, and any known limitations.

Before promoting to `main`, verify that `develop` is green and that the release scope has user approval.

## Current setup

- Integration branch: `develop`
- Current implementation branch: `feature/content-import`
- Batch A covers shell polish: breadcrumbs, favicon assets, social preview metadata, and legacy redirects.
