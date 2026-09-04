# Releasing

How the three `@earcon/*` packages reach npm. Rationale: ADR-0007; background:
`docs/research/2026-09-04-bun-publish-secure-release.md`.

## Versioning

- Changesets, `fixed` group: the three packages always share one version.
- `bunx changeset` adds a changeset with each behavioural change; on `main` the
  release workflow's version job opens a "Version Packages" pull request; merging it
  bumps versions and changelogs.
- Tag the merge commit `vX.Y.Z` to publish (or run the workflow manually).

## Every release (CI, no secrets)

`.github/workflows/release.yaml`, job `publish`:

1. GitHub-hosted runner, `permissions: id-token: write`, actions pinned by SHA.
2. `bun install --frozen-lockfile`, `just check`, `just build`, `just publish-dry`.
3. For each package: `bunx npm@latest publish --access public --provenance
   --registry https://registry.npmjs.org` from the package directory. Authentication
   is npm Trusted Publishing (OIDC); provenance is generated automatically.
4. Packages appear after npm's publish-time malware scan (5–15 minutes).

## First release only (bootstrap, from the requester's machine)

Trusted publishing cannot be configured for a package that does not exist yet.

1. On npmjs.com: create the `earcon` organization, enable account 2FA.
2. `just publish-dry`; read every tarball listing (dist, specs, README, LICENSE only).
3. Create a granular access token: write, packages `@earcon/core`,
   `@earcon/engine-tone`, `@earcon/react` only, shortest expiry that covers the day.
4. From each package directory:
   `NPM_CONFIG_TOKEN=<token> bunx npm@latest publish --access public --registry https://registry.npmjs.org`
   (`publishConfig` in each package.json also pins registry and access).
5. For each package: `bunx npm@latest trust github --allow-publish` with the
   repository and `release.yaml` as the workflow file.
6. Revoke the token. Set each package to "Require two-factor authentication and
   disallow tokens".
7. Confirm with a dry run of the workflow (`workflow_dispatch`, `dry_run: true`).

## Local checks before any release

- `just check` green, `just test-e2e` green.
- `just publish-dry`: no `src/`, tests or config in any tarball.
- `just build` passes the lazy-tone check (engine-tone main entry has no static `tone`).
- `bun audit --audit-level=high` clean (CI runs it; locally it needs the public
  registry reachable).
