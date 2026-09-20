## Development workflow

- `main` is the production branch. Do not develop directly on it.
- `develop` is the integration branch for all completed feature work.
- Create implementation branches from `develop` using `feature/<batch>-<short-name>`.
- Required promotion path: `feature/*` -> pull request to `develop` -> staging/UAT verification -> separate approved release pull request from `develop` to `main`.
- Never merge a feature branch directly into `main`, even when the feature has already been reviewed.
- Never force-push, rebase, amend, or squash commits that have already been pushed.
- When the worktree contains unrelated user changes, preserve them and commit only files belonging to the requested implementation.

## Safety and audit requirements

- Audit the relevant implementation surfaces, migrations, auth and permissions, provider integrations, CI configuration, current branch, and recent commits before substantial changes.
- Never print or commit secrets, private keys, tokens, passwords, or `.env` values. Never edit `.env` files.
- Keep UAT credentials in secure runtime environment variables or the approved CI secret store. A local protected temporary credential file may be used for a test run, but it must not be committed, copied into `.env`, or included in test artifacts.
- Do not deploy, mutate remote infrastructure, apply remote SQL, alter production data, force-push, or rewrite Git history without explicit permission for the specific target and action.

## Commit messages

Use Conventional Commits for every new commit:

- `feat:` for new functionality.
- `fix:` for bug corrections.
- `docs:` for documentation-only changes.
- `chore:` for maintenance, generated files, and dependency updates.
- `refactor:`, `test:`, `perf:`, `ci:`, or `build:` when those more specific categories apply.

Use an imperative, concise summary, for example: `chore: refresh dependency lockfile and route registration`.

## Testing handoff

After every implementation, the final response must include a concise **What to test** section with:

1. Automated checks that were run and their result.
2. Manual browser/functional checks for the user to perform.
3. Any known baseline failures or untested external integrations.

See [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) for the full branch, pull-request, and testing procedure..
