# 0004. `fromSpec` ships behind the `@earcon/engine-tone/from-spec` subpath

**Date:** 2026-09-04
**Status:** Accepted

## Context

Spec §4.4 exports `fromSpec` from `@earcon/engine-tone`; spec §4.1 requires that the
package's main entry never imports Tone.js statically so the initial bundle stays
Tone-free until `unlock()`. `fromSpec` imports Tone at module level. Exporting it
from the main entry made rolldown hoist it (and Tone) into a chunk the main entry
imports statically — found while inspecting `dist/` during M6 preparation.

## Decision

- `fromSpec` is a second build entry, exported as `@earcon/engine-tone/from-spec`.
  The main entry reaches it only through the lazily loaded presets module, for
  `{ kind: 'synth' }` specs.
- `just build` runs `scripts/check-lazy-tone.ts`, which walks the static import
  graph from `dist/index.js` and fails on any static `tone` import. CI runs
  `just build`, so the regression cannot ship.

## Consequences

### Positive
- The initial bundle contains only `createToneEngine`, the catalog and validation.
- The class of regression (any future Tone-importing export on the main entry) is
  caught mechanically, not by inspection.

### Negative
- Direct users of `fromSpec` import a subpath instead of the package root.

### Neutral
- The engine test seams (`loadTone`, `loadPresets`) are unchanged.
