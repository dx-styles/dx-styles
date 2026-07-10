# Release Process

The repository uses Changesets for versioning and GitHub Actions for CI and publishing.

## Local Changeset

Add a changeset for each package-facing change:

```sh
bun run changeset
```

Use patch, minor, and major according to the public `dx-styles` API impact.

## CI

Pull requests and pushes to `main` run:

```sh
bun run ci
```

The CI workflow installs dependencies with `bun install --frozen-lockfile` and then runs lint,
typecheck, tests, and build.

## Publishing

The release workflow runs on pushes to `main` and uses `changesets/action`.

Publishing authenticates through [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC) instead of a long-lived token, so no repository secret is required. The trust relationship is
configured on npmjs.com for the `dx-styles` package and points at this repository and the
`release.yml` workflow. The workflow needs:

- `permissions: id-token: write` (grants the OIDC token)
- npm >= 11.5.1 at publish time (the workflow updates npm before publishing)

The package has public `publishConfig` with npm provenance enabled. Publishing is performed by the
release workflow after Changesets creates a versioned release state.
