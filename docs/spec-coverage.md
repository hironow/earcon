# Spec coverage

Maps each acceptance test id from the spec (§3.10 T1–T20, §4.5, §5.5) to the test
that proves it. `packages/core/src/coverage.test.ts` asserts every core id (T1–T20)
appears in a core test name, so this table cannot silently drift.

| id | test file | test name |
| --- | --- | --- |
| T1 | `packages/core/src/monitor.test.ts` | `T1 hysteresis: enters at .10, exits at .12, does not re-enter at .119` |
| T2 | `packages/core/src/monitor.test.ts` | `T2 skips intermediate levels: .15 → .01 emits only enter{critical, from: null}` |
| T3 | `packages/core/src/monitor.test.ts` | `T3 demotion only via the current level exit: critical stays at .025 (no enter/exit events)` |
| T4 | `packages/core/src/monitor.test.ts` | `T4 demotion target: critical{exit .03} at .04 → exit{critical, to: warn} + enter{warn, from: critical}` |
| T5 | `packages/core/src/monitor.test.ts` | `T5 iValue: warn band [.05, .02) at .035 → intensity 0.5` |
| T6 | `packages/core/src/monitor.test.ts` | `T6 constant approach: .10 → .09 → .08 at 1s → velocity ≈ 0.01/s, eta ≈ 8s, iEta = …` |
| T7 | `packages/core/src/monitor.test.ts` | `T7 moving away: approach 0, eta Infinity, iEta 0` |
| T8 | `packages/core/src/monitor.test.ts` | `T8 irregular dt EMA: alpha = 1 - exp(-dt / tau) for dt 1s then 5s` and `T8 (value mode) …` |
| T9 | `packages/core/src/monitor.test.ts` | `T9 dt <= 0: second update at the same t returns [] and leaves state unchanged` |
| T10 | `packages/core/src/monitor.test.ts` | `T10 stale after staleAfterMs: tick(t + 15001) emits stale and keeps the level` |
| T11 | `packages/core/src/monitor.test.ts` | `T11 resume: the next update emits resume first, then normal transitions` |
| T12 | `packages/core/src/monitor.test.ts` | `T12 never-sampled monitor does not go stale` |
| T13 | `packages/core/src/monitor.test.ts` | `T13 ack cleared on escalate: ack-cleared{escalate} precedes enter` |
| T14 | `packages/core/src/monitor.test.ts` | `T14 ack cleared on exit (ackScope level): warn → watch emits ack-cleared{exit}` |
| T15 | `packages/core/src/monitor.test.ts` | `T15 ackScope until-safe: survives warn → watch, cleared on return to safe` |
| T16 | `packages/core/src/monitor.test.ts` | `T16 acknowledge in the safe zone is a no-op` |
| T17 | `packages/core/src/monitor.test.ts` | `T17 exit on the dangerous side of enter throws` |
| T18 | `packages/core/src/arbiter.test.ts` | `T18 worst-only: warn(.9), critical(.2), critical(acked) → [critical(.2)]` |
| T19 | `packages/core/src/arbiter.test.ts` | `T19 determinism: same level and intensity → id ascending` |
| T20 | `packages/core/src/purity.test.ts` + `.semgrep/rules/earcon-core-no-time.yaml` | `T20 core is time- and host-independent` |

## §4.5 engine (Playwright, `tests/e2e/engine.e2e.ts`)

| check | test name |
| --- | --- |
| (1) running context after unlock | `(1) unlock → Tone.getContext().state === "running"` |
| (2) all presets start/set/stop/dispose | `(2) every preset survives start/set/stop/dispose and play/dispose without throwing` |
| (3) parkingSensor ≈ 11 Hz | `(3) parkingSensor: set(1) drives the Clock to ≈ 11 Hz` |
| §9 leak check | `tests/e2e/leak.e2e.ts`: `50 start/stop cycles keep the heap stable after dispose` |

## §5.5 react wiring (`packages/react/src/store.test.ts`, `hooks.test.tsx`)

| case | test name |
| --- | --- |
| enter → start | `enter starts the level sound with the current intensity; escalate one-shot plays` |
| intensity → set | `intensity events call set() on the playing level sound` |
| ack → stop | `acknowledge stops the sound; intensity keeps flowing silently; ack-cleared on escalate restarts` |
| stale → knock repeats | `stale stops the sound and repeats the stale one-shot every staleRepeatSec; resume restores the level sound` |
| worst-only silences the second monitor | `worst-only: the second monitor at a lower level stays silent until it becomes the worst` |
| id change → dispose | `changing id disposes the old monitor and creates a new one` |
| SSR (§5.2) | `ssr.test.tsx`: `renders with status locked and never touches the engine` |

## §8 M3 simulator scenarios (`tests/e2e/simulator.e2e.ts`)

`whipsaw`, `crash`, `slow-approach`, `stale` each have one test; the manual slider
has one.

Additional core rules pinned by tests (ADR-0001): single-level band width, demotion to
safe, `staleAfterMs: 0`, `dt <= 0` while stale, double `acknowledge()`, `reset()`,
increasing direction, arbiter exclusions / ranking / `top-n`.
