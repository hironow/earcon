# Handover

**Last updated:** 2026-09-04 04:40 (JST)
**Updated by:** Claude Code session (earcon M0)

## Current State

M0 (scaffold), M1 (`@earcon/core`: T1–T20 green, 100% coverage), M2
(`@earcon/engine-tone`: presets, catalog, `createToneEngine`; demo Preset
Auditioner; Playwright §4.5 + §9 leak check) and M3 (`@earcon/react`: provider,
hooks, UnlockGate, sync-based wiring with 28 store/hook/SSR tests; demo Monitor
Simulator with the four §7.3 scenarios covered by Playwright) are done and
committed on `main`. `just check` and `just test-e2e` pass locally.

Post-M6 additions on 2026-09-04: Simulator direction validation (requester
report); preset catalog expanded to 28 (ADR-0005, two research surveys); chaos
test round (Playwright MCP subagent) fixed: `validateSynthSpec` in core, Designer
JSON crash, ErrorBoundary per tab, ticker monotonic-time guard, fromSpec build-time
validation, engine keeps working when one queued sound fails to build, Simulator
empty id / horizonSec / staleAfterMs validation, top-n clamp, save-name checks;
loudness pass (Tone.Offline peak per preset, `tests/e2e/loudness.e2e.ts`) fixed
stallWarning (too quiet), gong (clipping), squelch (too quiet); responsive pass for
phones / foldables / dual-screen / tablets (`tests/e2e/responsive.e2e.ts`: no
horizontal overflow on 8 viewports × 4 tabs, 44 px touch targets, safe-area insets,
`horizontal-viewport-segments` for hinged devices).

## In Progress

Nothing in flight. Next milestone is M4.

## Next Actions

1. M4 `fromSpec` (replace the stub in `packages/engine-tone/src/fromSpec.ts`),
   `specs/*.json` for sonar/parkingSensor/heartbeat/coin/chime/knock, Sound Designer tab
3. M5 Arbiter wiring, Wallets tab, `tests/e2e/background.e2e.ts` (90 s hidden tab)
4. M6 README Quick start, `docs/api.md`, first changeset (no publish, no deploy)

## Known Risks / Blockers

- `.github/workflows/ci.yaml` has never run (no remote). Verify on first push.
- `bun publish` needs npm login and the `@earcon` org; deferred until a remote exists.
- One-shot presets use monophonic Tone synths; the engine spaces same-instant
  `play()` calls by 10 ms (`MIN_ONESHOT_GAP_SEC`) so they do not throw.
- React StrictMode (dev) runs effects mount → cleanup → mount. The store's tick
  loop is therefore `start()`/`stop()`-able and the provider never `dispose()`s it
  in an effect cleanup. Found by the Simulator stale e2e; keep that test.
- The §9 leak check compares JS heap after forced GC (`--expose-gc`); Tone exposes
  no node count. Threshold 4 MB growth between cycle 10 and 50.

## Context the Next Actor Needs

- The design spec is private (`private/`, gitignored). Decisions and deviations are
  in `docs/adr/0001-spec-deviations-and-interpretations.md`.
- `tsconfig.base.json` maps `@earcon/*` to package sources via `paths`; Vite mirrors
  this with `resolve.alias`. `bun test` follows the tsconfig paths too, so no build is
  needed before tests.
- `just semgrep` runs the local `semgrep` binary (not `bunx`); CI installs it with
  `uv tool install semgrep`.
- `changeset init` is interactive; the config was written by hand.
- `bun test` from a package directory needs that package's own `bunfig.toml`
  (happy-dom preload); root `bunfig.toml` is not inherited.
- The demo exposes `window.__earcon` (dev only) for Playwright; `ticker()` sounds
  expose `.clock` for the parkingSensor rate assertion.
- `tests/e2e/background.e2e.ts` runs only in the `background` Playwright project
  (`bunx playwright test --project=background`, ~100 s). `just test-e2e` runs both
  projects.
- `apps/demo/src/debug.ts` wraps `engine.createContinuous` in dev so e2e can read
  which buses have a started continuous sound (`window.__earcon.activeContinuous()`).
- Demo-wide level → sound assignments live in `apps/demo/src/sound-assignments.ts`;
  the Simulator folds the assigned level ids into its monitor id so `useMonitor`
  recreates the monitor (it ignores non-id option changes by design).
- Design tokens for the demo live in `apps/demo/src/styles.css`; the rate LED per
  row is the one signature element (blinks at the mapped Hz from `presetRate`).

## Relevant Files and Commands

- `justfile` — every task; `just check` is the gate
- `.semgrep/rules/earcon-core-no-time.yaml` + `packages/core/src/purity.test.ts` — T20
- `docs/spec-coverage.md` — spec test id → test name
