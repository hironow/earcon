# 0006. Adopt `docs/research/` for dated investigation snapshots

**Date:** 2026-09-04
**Status:** Accepted

## Context

Release preparation needs a written survey of the current (2026-09) official
guidance on publishing from bun to npm without supply-chain contamination, before
any command is run. The documentation contract keeps `docs/*.md` current-state only,
so a dated, superseded-by-newer investigation needs its own opt-in category.

## Decision

Adopt `docs/research/` as defined in the global documentation discipline:
`YYYY-MM-DD-<topic>.md`, each a snapshot with a **Date** and **Status** header,
never treated as current-state documentation. A newer file on the same topic
supersedes the older one; conclusions that become decisions move into an ADR, and
procedures that become current practice move into `docs/*.md` or the justfile.

## Consequences

### Positive
- Findings and their sources are kept with the code that acts on them.

### Negative
- One more place to look; mitigated by the naming rule and this ADR.

### Neutral
- `docs/handover.md` links the latest snapshot when it is the next action.
