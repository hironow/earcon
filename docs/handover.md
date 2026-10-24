# Handover

**Last updated:** 2026-10-24 (JST)
**Updated by:** Codex

## Current State

earcon 0.0.2 is on npm (`@earcon/core`, `@earcon/engine-tone`, `@earcon/react`, one
shared version, SLSA provenance) and the demo is live at
https://hironow.github.io/earcon/. The spec's M0–M6 are complete: core state machine
(T1–T20, 100% coverage), Tone.js engine with 28 presets, React provider/hooks,
four-tab demo, 24 Playwright checks plus a 90 s hidden-tab test. Releases flow
changeset → bot "Version Packages" PR → `v*` tag → `release.yaml` (OIDC, reviewer
approval in the `release` environment). `main` is PR-only with required checks;
Dependabot, secret scanning, push protection, private vulnerability reporting and
CodeQL are on, aligned with `hironow/firepact` and `hironow/tablecodec`.

## In Progress

- PRs #23 and #25 passed check and e2e, but CodeQL reported NEUTRAL because
  Actions and JavaScript/TypeScript PR analyses were missing. Retrigger analysis
  through a normal branch push; require successful analyses on each current head
  before squash merge. Do not treat the aggregate green status as CodeQL success.
- [PR #15](https://github.com/hironow/earcon/pull/15): dependency refresh plus
  shell-quote 1.12.0 and source-map-js 1.2.2 security fixes. Local audit,
  `just check`, build, pack and all 25 E2E tests pass. Designer E2E also passed
  five repeats after waiting for the selected preset JSON. Check the PR for
  the current CI and merge status.
- `just update-deps <packages...>` refreshes only named dependencies.
- Local build validation needs Node 24 LTS; the inherited PATH selects Node
  20.10.0, which lacks the `node:util` `styleText` export required by rolldown.

## Next Actions

1. Use PR #15 for the dependency repair CI and merge status. All checks,
   including CodeQL, must pass before squash merge.
2. Re-check Dependabot's bun.lock v2 support now and then (see Known Risks); until
   then `bun audit` in CI is the dependency gate.
3. Listen to the 28 presets on real devices; tune the single-level band width
   (ADR-0001 D6) if it feels off. Any change: changeset → PR → version PR → tag.
4. Optional hardening, as in the sibling repos: `actions/attest-build-provenance` on
   the packed tarballs; `npm trust … --env release` to pin the trusted publisher to
   the environment; `npm stage publish` as a second gate (trust already allows it).
5. Sibling repos share the PR-only `main` ruleset (every `ci.yaml` PR job
   required, matched by name), secret-scanning extras, CodeQL, a relative uv
   `exclude-newer = "7 days"` and frozen lockfile installs (2026-09-04); their
   handover/release docs were delegated and reviewed.

## Known Risks / Blockers

- bun does not copy workspace versions into `bun.lock`; `bun pm pack` resolves
  `workspace:*` from the lockfile. `just release-version` runs
  `scripts/sync-lock-versions.ts` and `just pack` rejects mismatches. Re-check when
  bun changes this.
- Dependabot cannot parse `bun.lock` v2, so its bun version updates fail and its
  alert list is blind; `bun audit --audit-level=high` in CI is the only dependency
  vulnerability gate (docs/release.md). It depends on npm's advisories endpoint
  (503 twice on 2026-09-04, hence the retry in `just audit`) and is not part of
  `just check`.
- The bot's "Version Packages" PR needs its workflow run approved before required
  checks can pass (`gh api -X POST repos/hironow/earcon/actions/runs/<id>/approve`).
- Firefox/Safari are supported targets but only Chromium is tested automatically.

## Context the Next Actor Needs

- The design spec is private (`private/`, gitignored). Decisions and deviations:
  `docs/adr/0001`–`0011`; test-id mapping: `docs/spec-coverage.md`.
- The npm CLI never rewrites `workspace:`/`catalog:`; only bun-packed tarballs
  (`just pack`) may be published. `bun publish` is never used (no OIDC).
- A developer's `~/.npmrc` may point at a private mirror; the project `bunfig.toml`
  pins registry.npmjs.org. Pass `--registry https://registry.npmjs.org/` to any manual
  npm command.
- React StrictMode runs effects twice; the store's tick loop is started by the
  provider effect, never at creation.
- `@earcon/engine-tone`'s main entry must not import `tone` statically; `just build`
  checks the chunk graph. `fromSpec` lives at the `./from-spec` subpath.
- Demo: Vite `base` comes from `DEMO_BASE` (`/earcon/` on Pages, `/` locally);
  `window.__earcon` exists only in dev for Playwright.

## Relevant Files and Commands

- `docs/release.md` - the release procedure (bootstrap, CI, rules)
- `.github/workflows/{ci,release,pages}.yaml` - gates, publish, demo deploy
- `scripts/pack-check.ts`, `scripts/sync-lock-versions.ts`, `scripts/check-lazy-tone.ts` - release guards
- `packages/react/src/store.ts` - event → sound wiring (ADR-0003)
- `just check` - tsc -b + semgrep + bun test + core coverage gate
- `just audit` - bun audit with a retry on registry errors (CI and release gate)
- `just test-e2e` - Playwright (Chromium; `bunx playwright install chromium` once)
- `just build && just pack` - dist + publishable tarballs in `dist-pack/`
- `just release-version` - changeset version + lockfile sync (CI runs it)
- `just dev` / `just dev-lan` - demo locally / on the LAN for phones
