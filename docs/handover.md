# Handover

**Last updated:** 2026-09-04 02:30 (JST)
**Updated by:** Claude Code session (earcon M0)

## Current State

M0 scaffold is done: bun workspace with `@earcon/core`, `@earcon/engine-tone`,
`@earcon/react` (empty `export {}`), `apps/demo` (Vite, placeholder page), justfile,
project references (`tsc -b`), Semgrep purity rule + bun test twin (T20), changesets
(`fixed` group), CI workflow file. `just build`, `just lint`, `just test`,
`just publish-dry` all pass locally.

## In Progress

Nothing in flight. Next milestone is M1.

## Next Actions

1. M1 `@earcon/core`: `createMonitor` (T1–T17) and `selectAudible` (T18–T19), TDD,
   coverage gate via `just test-core`
2. M2 `@earcon/engine-tone`: presets from the spec appendix, `createToneEngine`,
   Preset Auditioner in the demo, Playwright §4.5 + leak check
3. M3 `@earcon/react`, M4 `fromSpec` + Sound Designer, M5 Arbiter + Wallets +
   background-tab test, M6 README / API docs / changeset (no publish)

## Known Risks / Blockers

- `.github/workflows/ci.yaml` has never run (no remote). Verify on first push.
- `bun publish` needs npm login and the `@earcon` org; deferred until a remote exists.
- Playwright Chromium is not installed yet (`bunx playwright install chromium`).

## Context the Next Actor Needs

- The design spec is private (`private/`, gitignored). Decisions and deviations are
  in `docs/adr/0001-spec-deviations-and-interpretations.md`.
- `tsconfig.base.json` maps `@earcon/*` to package sources via `paths`; Vite mirrors
  this with `resolve.alias`. `bun test` follows the tsconfig paths too, so no build is
  needed before tests.
- `just semgrep` runs the local `semgrep` binary (not `bunx`); CI installs it with
  `uv tool install semgrep`.
- `changeset init` is interactive; the config was written by hand.

## Relevant Files and Commands

- `justfile` — every task; `just check` is the gate
- `.semgrep/rules/earcon-core-no-time.yaml` + `packages/core/src/purity.test.ts` — T20
- `docs/spec-coverage.md` — spec test id → test name
