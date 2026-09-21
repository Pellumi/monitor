# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).
It drives versioning for every published SDK, whichever registry it goes to:

- `@tellann/frontend-sdk` — npm
- `@tellann/backend-sdk` — npm
- `@tellann/python-sdk` — PyPI, as `tellann`

The Python package is marked `"private": true` so `changeset publish` does not
try to push it to npm; it is still versioned here, so the whole repository has
one version flow, one "Version Packages" PR and one changelog per package.
Its `package.json` exists only for that, and to let `turbo run test` run its
`unittest` suite alongside the others.

Every other package in the monorepo is marked `"private": true` and is never
versioned or published.

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
   `changeset publish` and pushes the new versions to npm. A second job then
   publishes the Python SDK to PyPI if — and only if — the version now in
   `packages/python-sdk/pyproject.toml` is not already there, which makes it a
   no-op on every other push to `main`.

`pnpm release:version` runs `changeset version` and then
`scripts/sync-python-version.mjs`, which copies the Python package's new
version out of its `package.json` and into `pyproject.toml` and
`src/tellann/__init__.py`, translating npm prerelease tags to their PEP 440
spelling (`1.2.3-beta.0` becomes `1.2.3b0`).

See `.github/workflows/release.yml`. npm publishing authenticates with the
`NPM_TOKEN` repository secret; PyPI publishing uses Trusted Publishing, so
there is no PyPI token to store or rotate.
