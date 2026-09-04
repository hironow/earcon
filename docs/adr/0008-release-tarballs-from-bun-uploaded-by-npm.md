# 0008. Release: tarballs packed by bun, uploaded by a pinned npm CLI over OIDC

**Date:** 2026-09-04
**Status:** Accepted (supersedes 0007)

## Context

ADR-0007 chose "build with bun, publish with the npm CLI" but ran
`bunx npm@latest publish` from each package directory. An independent review
(Codex) and a primary-source fact check (2026-09-04) established:

- The npm CLI does not understand the `workspace:` and `catalog:` protocols
  (npm's workspaces docs write plain semver ranges; npm/cli #8845). It would publish
  `"@earcon/core": "workspace:*"` verbatim and every consumer install would fail
  with `EUNSUPPORTEDPROTOCOL`. `bun pm pack` and `bun publish` strip both
  protocols and resolve versions (bun docs: publish, catalogs, workspaces).
- Trusted Publishing needs npm ≥ 11.5.1 and Node ≥ 22.14. `ubuntu-latest`
  (Ubuntu 24.04 image 20260823) ships Node 22.23 with npm 10.9.8, which is too old;
  Node 24 (setup-node) ships npm 11.19.
- `bunx` runs a `#!/usr/bin/env node` binary under whichever Node is on PATH, and
  `npm@latest` is mutable code executed with publish rights. Both are avoidable.
- With OIDC, npm adds provenance itself; `--provenance` is not needed, and its
  behaviour when publishing a tarball path is undocumented.
- The `version` job in the previous workflow could never run (the workflow had no
  `main` trigger) and the publish job lacked Semgrep for `just lint`.

## Decision

1. `just pack` (`scripts/pack-check.ts`) packs the three packages with
   `bun pm pack` into `dist-pack/` and fails if a packed manifest still contains
   `workspace:` or `catalog:` or a tarball contains unexpected top-level entries.
   These tarballs are the only thing ever handed to the npm CLI.
2. The publish job installs Node 24 with a SHA-pinned `actions/setup-node`,
   asserts `npm >= 11.5.1`, and runs `npm publish dist-pack/<pkg>.tgz --access
   public --registry https://registry.npmjs.org` under `id-token: write`. No
   `--provenance` flag; a best-effort step polls `dist.attestations` for 15 minutes.
3. The workflow triggers on pushes to `main` (version PR via `just release-version`,
   which also refreshes `bun.lock`), on `v*` tags (publish) and on manual dispatch
   (dry run by default). The tag must equal every package version. Semgrep is
   installed at a pinned version.
4. Everything else from ADR-0007 stands: npm CLI only for the upload, public
   repository, bootstrap release from the requester's machine with a short-lived
   token followed by `npm trust`, `minimumReleaseAge`, `bun audit`, no scanner, no
   name reservations.

## Consequences

### Positive
- Consumers can install the published packages (the one critical defect is closed
  mechanically by `just pack`, which CI runs before every publish).
- The publish toolchain is pinned end to end: bun 1.4.0, actions by SHA, Node 24,
  semgrep 1.176.0.

### Negative
- Provenance for tarball-path publishes is verified after the fact, not guaranteed
  up front; the first tagged release must be checked by hand.

### Neutral
- If `bun publish` gains OIDC + provenance, the upload step returns to bun without
  touching the packing step.
