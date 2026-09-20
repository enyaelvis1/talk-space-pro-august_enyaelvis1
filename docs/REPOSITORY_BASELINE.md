# Repository baseline

This project is a TanStack Start application that uses TypeScript and npm with a committed
`package-lock.json` for reproducible installs.

## Supported toolchain

- Node.js 22 or newer.
- npm as the primary package manager.
- TypeScript for application and test code.

## Baseline files

- `package.json` defines the runtime and development scripts.
- `package-lock.json` is the authoritative dependency lockfile for local and CI installs.
- `tsconfig.json` defines the TypeScript project boundary.
- `eslint.config.js` defines the linting ruleset.
- `.env.example` documents the expected environment variables.
- `.githooks/pre-commit` runs staged-file formatting, lint, and secret checks after install.
- `.github/workflows/ci.yml` and `.github/workflows/security.yml` run CI, dependency audit,
  and secret scanning on pull requests and branch pushes.

## Working rules

- Use `npm ci` in CI and release verification to guarantee the lockfile matches the installed tree.
- Update the lockfile intentionally whenever dependencies change.
- Keep new scripts and tooling aligned with the npm workflow unless the team explicitly changes the package manager.
- Keep the pre-commit hook active by running `npm install` in a fresh checkout.
- Run `npm run audit:deps` for the production dependency scan and let the GitHub security workflow
  handle secret scanning and Dependabot update tracking.
