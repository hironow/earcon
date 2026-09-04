# 0009. The first release is 0.0.1

**Date:** 2026-09-04
**Status:** Accepted (amends ADR-0001 item on versioning)

## Context

The scaffold carried `0.1.0` in every package while the initial changeset was a
`minor` bump, so the first `changeset version` would have produced `0.2.0`. The
requester wants the very first published version to be `0.0.1`.

## Decision

- Package versions are `0.0.0` in the repository until the first
  `just release-version` run; the initial changeset is a `patch`, so the first
  release is `0.0.1` and every later release follows the changesets flow.
- The `fixed` group keeps the three packages on one version.

## Consequences

### Positive
- The first release goes through the same versioning path as every later one.

### Negative
- `0.0.x` signals "pre-alpha" to consumers; that is intended.

### Neutral
- `1.0.0` is a separate, later decision.
