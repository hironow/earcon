# 0011. A reviewer approves every publish (GitHub environment `release`)

**Date:** 2026-09-04
**Status:** Accepted (extends 0008)

## Context

With ADR-0008 a pushed `v*` tag published to npm with nobody able to stop it. The
requester wants a human approval between the tag and the upload. GitHub Actions has
exactly one built-in mechanism for pausing a job for approval: environment
protection rules. The requester's other repositories (`hironow/firepact`,
`hironow/tablecodec`) already use an environment named `release` with a required
reviewer and a `v*` tag policy in front of their OIDC publish jobs.

## Decision

- Environment `release` on `hironow/earcon`: required reviewer `hironow`, deployment
  policies tag `v*` and branch `main` (the latter only for `workflow_dispatch` dry
  runs).
- `release.yaml`'s `publish` job declares `environment: release`. A tag push builds,
  packs and then waits; the reviewer approves in the run's UI (or rejects/cancels).
- npm-side staged publishing (`npm stage publish`) stays available as a second
  gate if ever wanted; the trusted publisher already allows it.

## Consequences

### Positive
- Publishing requires two human actions on GitHub (merge the version PR, approve
  the environment) plus the tag; the approval is auditable in the run.
- Same convention as the requester's other projects.

### Negative
- Dry runs from `main` also wait for approval.

### Neutral
- Adding `--env release` to the npm trusted-publisher configuration would pin the
  publish to this environment; not done yet (the workflow file is already pinned).
