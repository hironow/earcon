# Releasing

How the three `@earcon/*` packages reach npm. Rationale: ADR-0008 (supersedes
ADR-0007); background: `docs/research/2026-09-04-bun-publish-secure-release.md`.

## Two facts that shape everything

- The npm CLI does not understand `workspace:` or `catalog:`; it would publish them
  verbatim and every consumer install would fail. Only `bun pm pack` resolves them.
  So tarballs are always produced by bun (`just pack`) and the npm CLI only uploads
  them.
- `bun publish` has no npm Trusted Publishing (OIDC) or provenance support, so the
  upload step uses the npm CLI installed by `actions/setup-node` (Node 24 ships
  npm ≥ 11.5.1; the runner's own npm 10.9 is too old).

## Versioning

- Changesets, `fixed` group: the three packages always share one version.
- `bunx changeset` records each behavioural change. On every push to `main` the
  release workflow's `version` job opens or updates the "Version Packages" pull
  request by running `just release-version` (bump + `bun install --lockfile-only`).
- Merge that PR, then tag the merge commit `vX.Y.Z` and push the tag.

## Every release (CI, no secrets)

`.github/workflows/release.yaml`, job `publish`, on a `v*` tag (or manual dispatch,
dry-run by default):

1. GitHub-hosted runner, `permissions: id-token: write`, every action pinned by SHA,
   semgrep pinned, Node 24 via setup-node with an explicit npm ≥ 11.5.1 check.
2. `bun install --frozen-lockfile`, `bun audit --audit-level=high`, `just check`,
   `just build`, `just pack` (fails if any packed manifest still has `workspace:` /
   `catalog:` or an unexpected file).
3. The tag must equal every package version.
4. `npm publish dist-pack/<pkg>.tgz --access public --registry https://registry.npmjs.org`
   for each tarball. Authentication is OIDC; npm adds provenance itself (no
   `--provenance` flag; publishing a tarball path with provenance is not documented,
   so the next step checks the result).
5. A best-effort step polls `npm view <pkg>@<ver> dist.attestations` for up to
   15 minutes (npm's publish-time malware scan delays visibility). If it reports
   nothing, check by hand once the packages are visible.

## First release only (bootstrap, from the requester's machine)

Trusted publishing cannot be configured for a package that does not exist yet.

1. On npmjs.com: create the `earcon` organization, enable account 2FA.
2. Local toolchain: Node ≥ 22.14 and npm ≥ 11.5.1 (`npm --version`).
3. `just build && just pack`; read every tarball listing in `dist-pack/`
   (dist, specs, README, LICENSE only).
4. Create a granular access token: write, packages `@earcon/core`,
   `@earcon/engine-tone`, `@earcon/react` only, shortest expiry that covers the day.
5. For each tarball:
   `NPM_CONFIG_TOKEN=<token> npm publish dist-pack/<pkg>.tgz --access public --registry https://registry.npmjs.org`
   (`publishConfig` in each package.json also pins registry and access).
6. For each package: `npm trust github --allow-publish` with the repository and
   `release.yaml` as the workflow file.
7. Revoke the token. Set each package to "Require two-factor authentication and
   disallow tokens".
8. Run the workflow manually with `dry_run: true`, then make the next real release
   from a tag and confirm `dist.attestations` shows a provenance entry.

## Known unknowns (verify on the first tagged release)

- Whether provenance is attached when publishing a tarball path under OIDC (npm
  documents the flag-less OIDC path for directory publishes only).
- Whether npm's staged publishing (2026-05) requires a human approval step for
  ordinary publishes of existing packages.

## Local checks before any release

- `just check` green, `just test-e2e` green.
- `just pack`: three tarballs, protocols resolved, nothing unexpected inside.
- `just build` passes the lazy-tone check (engine-tone main entry has no static `tone`).
- `bun audit --audit-level=high` clean (CI runs it; locally it needs npm's advisories
  endpoint reachable).
