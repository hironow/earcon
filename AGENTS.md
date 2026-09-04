# AGENTS.md — earcon

Repository-specific instructions. The global baseline (`~/.claude-work-a/AGENTS.md`:
bun only, just only, `.yaml` only, TDD, Tidy First, Conventional Commits) applies
unchanged; this file only adds what is specific here.

## What this repo is

A bun workspace publishing three ESM packages (`@earcon/core`, `@earcon/engine-tone`,
`@earcon/react`) plus `apps/demo` (Vite). The design is fixed by a private spec
(not in the repo); deviations and interpretations are recorded in `docs/adr/`.

## Hard rules

- `packages/core/src` never references `Date`, `performance`, timers, `window`,
  `globalThis`. Time arrives as arguments (`Sample.t`, `tick(nowMs)`). Enforced by
  `.semgrep/rules/earcon-core-no-time.yaml` and `packages/core/src/purity.test.ts`.
- `@earcon/react` imports only `@earcon/core` (the `Engine` interface), never
  `@earcon/engine-tone` or `tone`.
- `tone` is never statically imported from `packages/engine-tone/src/index.ts`;
  it is loaded inside `unlock()`.
- Every millisecond handed to `core` is on the `performance.now()` axis. Never pass
  AudioContext seconds.
- Unit tests are colocated (`src/*.test.ts`, `bun:test`). Playwright tests live in
  `tests/e2e/`. No mocks in e2e.

## Release

Publishing goes through `.github/workflows/release.yaml` with npm Trusted
Publishing. The publish step runs `bunx npm publish` — the single sanctioned
exception to "bun only", because `bun publish` has no OIDC/provenance (ADR-0007).
Never run `bun publish`; never put an npm token in CI. Procedure: `docs/release.md`.

## Commands

`just check` is the gate (`tsc -b`, semgrep, `bun test`, core coverage ≥ 90%).
`just test-e2e` needs `bunx playwright install chromium` once.

## Docs

`docs/intent.md` (why), `docs/handover.md` (where we are), `docs/adr/` (why we
deviated), `docs/spec-coverage.md` (spec test id → test name).
