# 0002. engine-tone: catalog split, deferred fromSpec, and test seams

**Date:** 2026-09-04
**Status:** Accepted

## Context

Spec §4.1 requires `presets.ts` to be dynamically imported after `unlock()` so the
initial bundle excludes Tone.js, and spec §4.3 makes an unknown preset id throw.
The demo (§7.2) must list the catalog *before* unlock, and `createContinuous`
should fail fast on a typo without waiting for the audio to be unlocked. Spec §4.5
asks for `mock.module('tone')` unit tests, which cannot exercise the dynamic
`import('tone')` inside the engine without a seam.

## Decision

1. `catalog` and `defaultLevelSounds` move from `presets.ts` to `catalog.ts` (no
   Tone import). `presets.ts` re-exports them, so the appendix's public surface is
   unchanged. `catalog.ts` also derives `presetIds`, used for synchronous
   `{ kind: 'preset', id }` validation, and carries a `rate` hint per continuous
   preset for UI.
2. `createToneEngine` accepts `@internal` seams `loadTone` / `loadPresets`
   (default: dynamic imports). Unit tests inject a fake Tone and recording preset
   factories; the real dynamic import path is covered by Playwright.
3. `fromSpec` ships as a throwing stub until M4; `presets.ts` re-exports it so the
   engine resolves `SynthSpec` through the same lazily loaded module.
4. The shared fake Tone lives in `tests/utils/fake-tone.ts`; `tests/` is its own TS
   project referenced by packages that import it.

## Consequences

### Positive
- Initial bundle stays Tone-free while the catalog is available synchronously.
- Engine wiring (deferred sounds, buses, clocks, status) is unit-tested in ms.

### Negative
- Two `@internal` options exist on the public factory; they are documented as
  test-only and excluded from the README.

### Neutral
- `fromSpec` behaviour is specified in M4 (ADR if it deviates from §4.4).
