# 0001. Deviations from and interpretations of the earcon spec v0.1

**Date:** 2026-09-04
**Status:** Accepted

## Context

The private design spec (`earcon-spec.md` v0.1) fixes the architecture and the
acceptance tests. Implementation surfaced places where the spec is either
impractical as written or silent. Spec §11 requires each deviation to be recorded
as an ADR; items touching differentiators D1/D2 were confirmed with the requester
before implementation (grill rounds on 2026-09-04).

## Decision

Deviations (spec text replaced):

1. **tsdown pinned** to `^0.22.14` instead of catalog `latest` — reproducible lockfile.
2. **Semgrep** rules live in `.semgrep/rules/*.yaml` and run through the local
   `semgrep` binary, not `bunx semgrep --config .semgrep.yaml` (Semgrep is a Python
   tool; `bunx` cannot run it).
3. **`bun publish --filter` does not exist.** Per-package scripts `publish:dry`
   (`bun pm pack --dry-run`) and `publish:npm` are run through `bun run --filter`.
4. **Coverage gate** (`coverageThreshold = 0.9`) is set in `packages/core/bunfig.toml`
   and enforced by `just test-core`, because bun applies the threshold to every file
   in a run and the root run includes non-core packages.
5. **T20 is enforced twice**: Semgrep rule and a `bun:test` grep test, so the guard
   holds where Semgrep is not installed. Test files are excluded from the scan.
6. **T3 asserts** "no `enter`/`exit` events" rather than "no events": the intensity
   event legitimately fires when the value moves inside the level.
7. `ticker()` from the spec appendix moves to `packages/engine-tone/src/ticker.ts`
   so `fromSpec` can reuse it; `presets.ts` imports it (one-line diff from the appendix).

Interpretations (spec silent; confirmed with the requester where they touch D2):

8. **Time axis.** `Engine.scheduleRepeat` passes `performance.now()`-axis
   milliseconds, the same axis as `Sample.t`. AudioContext seconds never reach `core`.
9. **Velocity** is always the EMA value (spec §3.4 formula) in both urgency modes;
   only `eta` is mode-dependent. The EMA is initialized with the first raw rate.
10. **Resume after stale** uses the spec EMA unchanged: with a long gap the raw rate is
    the average over the gap, not a spike, so no special casing.
11. `dt <= 0` samples are ignored entirely (`[]`), even while stale (no `resume`).
12. `acknowledge()` while already acknowledged is a no-op (`[]`).
13. Demotion event order: `exit` → `ack-cleared{exit}` (if any) → `enter{to}` (if any).
14. **Stale sound during acknowledge**: the stale one-shot keeps repeating while a
    monitor is acknowledged (ack means "I know this level", not "stop watching data").
15. **One-shots queued before `unlock()`** are discarded; only continuous sounds
    replay their last `start`/`set` state once the engine is ready.
16. `NotifierProvider.sounds` is optional; default is
    `{ watch: sonar, warn: parkingSensor, critical: hiLoSiren }` as preset references.
17. Intensity events call `set()` only when the level's continuous sound is started
    and the monitor is selected by the arbiter.
18. Monitor disposal / `id` change clears the stale-repeat state.

## Consequences

### Positive
- Reproducible builds and a gate that works without npm auth or Semgrep.
- The spec's acceptance tests remain the source of truth; every interpretation has a
  test naming the rule.

### Negative
- Two guards for T20 must be kept in sync by hand.
- `just test-core` is an extra step beside `just test`.

### Neutral
- Future spec revisions that resolve items 8–18 supersede this ADR.
