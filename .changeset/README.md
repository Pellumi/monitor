# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).
It drives versioning and npm publishing for the **publishable** workspace packages:

- `@tellann/frontend-sdk`
- `@tellann/backend-sdk`

Every other package in the monorepo is marked `"private": true` and is never
versioned or published by changesets.

## Making a release

1. After making a change to an SDK, run:

   ```bash
   pnpm changeset
   ```

   Pick the affected package(s) and a bump type (patch / minor / major), and write
   a one-line summary. This creates a markdown file in `.changeset/` — commit it
   with your PR.

2. When changeset PRs land on `main`, the **Release** GitHub Actions workflow opens
   (or updates) a "Version Packages" PR that applies the pending bumps and updates
   each package's `CHANGELOG.md`.

3. Merging that "Version Packages" PR triggers the workflow again, which runs
   `changeset publish` and pushes the new versions to npm.

See `.github/workflows/release.yml`. No local `npm login` / OTP is needed — CI
authenticates with the `NPM_TOKEN` repository secret.
