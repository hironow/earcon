# 0003. @earcon/react: sync-based wiring and spec extensions

**Date:** 2026-09-04
**Status:** Accepted

## Context

Spec §5.4 lists per-event sound actions and adds "re-evaluate the arbiter whenever
any monitor emits an event". Implementing the table literally and the arbiter pass
separately duplicates the start/stop logic. The demo (§7.3) needs the event stream
for its log, which `useMonitor` (§5.2) does not return. §5.1 gives no default for
`policy`.

## Decision

1. **One sync step.** After every event batch the store computes
   `selectAudible(...)` and reconciles each monitor's continuous sound against it:
   start when newly selected, `set` when the intensity changed, stop when
   deselected, silent, acknowledged or stale. The §5.4 rows for `enter`, `intensity`,
   `exit`, `ack` and `ack-cleared` are consequences of this step; only one-shots
   (`escalate`, `toSafe`, `stale`) are triggered from the events themselves.
2. `escalate` plays on promotions only (the `enter` that follows a demotion's `exit`
   does not count).
3. `useMonitor` accepts `onEvent(events, state)` as an extension for logs and
   analytics. It is not React state and does not trigger renders.
4. `NotifierProvider.policy` defaults to `{ mode: 'worst-only' }` (the spec's own
   example); `tickIntervalSec` 1, `staleRepeatSec` 10.
5. `getState(id)` for an id without a monitor returns a stable placeholder so
   `useSyncExternalStore` sees a constant snapshot before the mount effect runs.
6. `update()` for an id without a monitor is a no-op; there is no queue.

## Consequences

### Positive
- One code path for all continuous-sound decisions; the §5.5 cases plus the
  ADR-0001 rules are covered by 17 store tests with a recording engine.

### Negative
- The sync step runs over every monitor on every event; with hundreds of monitors
  and high-frequency updates this is O(n) per update. Acceptable for the wallet
  use case (tens of monitors).

### Neutral
- The spec's §5.4 table remains the documented behaviour; this ADR records how it
  is produced.
