# Intent

**Last updated:** 2026-09-04 (post-release refresh)
**Requester:** hironow
**Work unit:** earcon v0.1 — implement the private spec `earcon-spec.md` v0.1

## Goal

Ship a React sonification hook library that plays "something is approaching", not
"something happened": continuous values are mapped to the repetition rate and pitch
of synthesized sounds, with metaphors people already understand (sonar, parking
sensor, heartbeat).

## Success Criteria

- Spec §3.10 acceptance tests T1–T20 all green; `@earcon/core` coverage ≥ 90%
- Spec §4.5 (engine, real browser via Playwright) and §5.5 (React wiring with a
  mock engine) tests green
- `just lint` green (types + Semgrep)
- All 28 presets audible in the demo; 50× start/stop leaves the audio graph stable
- README Quick start reaches "a sound plays" within 5 minutes
- Every deviation from the spec is recorded as an ADR

## Scope

### In scope
- `@earcon/core`, `@earcon/engine-tone`, `@earcon/react` and `apps/demo`
  (Preset Auditioner, Monitor Simulator, Sound Designer, Wallets Demo)
- Milestones M0–M5 fully; M6 prepared (README, API docs, changesets)

### Out of scope (Non-goals)
- Exchange-specific code; the library only receives normalized numbers
- Visual notification UI beyond the headless unlock / mute / acknowledge controls
- Bundled audio samples (everything is synthesized), CommonJS output
- A graph-based sound editor (the Sound Designer is form-based)
- Publishing or deploying without an explicit GO from the requester (0.0.1 was
  published on 2026-09-04 with that GO; later releases follow `docs/release.md`)

## Constraints

- Differentiators D1 (metaphor presets) and D2 (rate output + ETA input) must not be
  weakened; changes touching them need requester confirmation before implementation
- bun / just / tsdown / Playwright / Semgrep / changesets toolchain; ESM only
- Repository `github.com/hironow/earcon` (public); releases via npm Trusted
  Publishing from GitHub Actions, never with a stored token

## Open Questions

- [x] npm org `earcon` — created 2026-09-04, packages published under it
- [ ] Publish directly from CI or stage for human approval (`npm stage publish`)
