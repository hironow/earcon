# 0007. Release pipeline: build with bun, publish with the npm CLI over OIDC

**Date:** 2026-09-04
**Status:** Accepted

## Context

`docs/research/2026-09-04-bun-publish-secure-release.md` (35 primary sources,
re-verified) found that as of 2026-09:

- npm revoked classic tokens (2025-12-09), caps write tokens at 90 days, and
  recommends Trusted Publishing (OIDC) for CI with provenance generated automatically.
- `bun publish` supports neither OIDC nor provenance (oven-sh/bun #22423, #15601
  open). Publishing with bun means keeping a 90-day token in CI secrets, the asset
  the 2025 worms stole.
- A trusted publisher cannot be configured before the package exists (npm/cli #8544).
- npm's own install defaults now refuse dependency lifecycle scripts, git and remote
  dependencies; bun already refuses lifecycle scripts unless `trustedDependencies`.

The requester decided on 2026-09-04 (grill round 5): allow the npm CLI for the
publish step only; public GitHub repository; first release from a local machine
with a short-lived token; no third-party dependency scanner for now; no defensive
name reservations.

## Decision

1. **Exception to "bun only"**: the publish transport is `bunx npm@latest publish`.
   Everything else (install, build, test, `changeset version`) stays bun. The
   exception ends when `bun publish` supports OIDC + provenance.
2. **Workflow** `.github/workflows/release.yaml`: manual dispatch or a `v*` tag;
   `permissions: id-token: write`; GitHub-hosted runner; every action pinned to a
   commit SHA; `bun install --frozen-lockfile`; `just build`; publish each package
   with `--access public --registry https://registry.npmjs.org`. No secrets.
3. **First release (bootstrap)**: from the requester's machine with a 90-day
   granular token scoped to the three packages, `--access public`; then
   `npm trust github` for each package pointing at `release.yaml`; revoke the token;
   set each package to "require 2FA and disallow tokens". Procedure in
   `docs/release.md`.
4. **Hygiene**: `bunfig.toml` `[install] minimumReleaseAge = 604800` with
   `@earcon/*` excluded; `bun audit --audit-level=high` in CI; `publishConfig`
   pins `registry` and `access` so a local mirror registry can never receive a
   publish; tarballs checked with `just publish-dry` before every release.
5. Not adopted: `[install.security] scanner`, unscoped name reservations.

## Consequences

### Positive
- No long-lived npm credential exists anywhere after the bootstrap.
- Provenance links every published tarball to the public workflow run.

### Negative
- One tool outside bun in the release path; documented and reversible.
- Publishing waits 5–15 minutes for npm's malware scan before packages are visible.

### Neutral
- `changesets/action` is used only to open the version PR; publishing is explicit.
