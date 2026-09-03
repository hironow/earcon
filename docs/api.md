# API

Current public surface of the three packages. Types are exported from the package
that owns them; `@earcon/react` re-exports nothing from `@earcon/core`.

## `@earcon/core`

### `createMonitor(opts: MonitorOptions): Monitor`

| option | default | meaning |
| --- | --- | --- |
| `id` | — | monitor id (also the bus id) |
| `direction` | — | `'decreasing'`: the value shrinking is the danger; `'increasing'`: growing |
| `levels` | — | safe → dangerous order; each `{ id, enter, exit }`, `exit` on the safe side of `enter` (validated) |
| `urgency` | `{ mode: 'value' }` | `{ mode: 'eta', eventAt, horizonSec? (300) }` folds ETA into intensity |
| `velocityWindowMs` | `10_000` | EMA time constant for the rate of change |
| `staleAfterMs` | `15_000` | watchdog; `0` disables |
| `ackScope` | `'level'` | `'until-safe'` keeps the acknowledge through demotions |

`Monitor`:

- `state: MonitorState` — `{ id, level, stale, intensity, eta, velocity, acknowledged, lastSample }`
- `update({ value, t })` → `MonitorEvent[]` — `t` in monotonic milliseconds; `t <= previous` is ignored (`[]`)
- `tick(nowMs)` → `MonitorEvent[]` — watchdog; `nowMs` on the same axis as `t`
- `acknowledge()` → `MonitorEvent[]` — `[]` in the safe zone or when already acknowledged
- `reset()`

Events: `enter { level, from }`, `exit { level, to }`, `intensity { value }`, `stale`,
`resume`, `ack`, `ack-cleared { reason: 'escalate' | 'exit' }`. Order within one
`update`: `resume` → (`ack-cleared` escalate) → `enter` | `exit` → (`ack-cleared` exit) →
`enter` (demotion target) → `intensity`.

Intensity: `iValue = clamp01((d - enter_k) / bandWidth_k)` where the band is the
distance to the next level's `enter` (top level: the previous band; single level:
`|enter - exit| * 4`). In `eta` mode `intensity = max(iValue, iEta)` with
`iEta = clamp01(1 - log10(max(eta, 1)) / log10(horizonSec))`. `velocity` is always
the EMA of the rate of change of the danger score (positive = approaching).

### `selectAudible(states, levelIndexOf, policy): string[]`

Pure. Excludes safe, acknowledged and stale monitors; ranks by level index desc,
intensity desc, id asc; applies `{ mode: 'all' | 'worst-only' | 'top-n', n }`.

### Engine contract

`Engine`, `EngineStatus` (`'locked' | 'ready' | 'suspended' | 'unavailable'`),
`Bus`, `ContinuousSound` (`start(i)`, `set(i)`, `stop()`, `dispose()`),
`OneShotSound` (`play({ transpose?, velocity? })`, `dispose()`).
`Engine.scheduleRepeat(cb, intervalSec)` passes `performance.now()`-axis
milliseconds to `cb`.

### `SoundSpec`

`{ kind: 'preset', id }` | `SynthSpec` | `{ kind: 'custom', factory }`.

`SynthSpec` (JSON-serializable): `kind: 'synth'`, `mode: 'continuous' | 'oneShot'`,
`voice`, `oscillator?`, `envelope`, `volume`, `fx?: { delay?, filter? }`; continuous:
`rate? { minHz, maxHz, curve? }`, `pitch? { base, semitonesAtMax }`, `pattern?`;
one-shot: `notes? [{ note, at, dur }]`.

## `@earcon/engine-tone`

### `createToneEngine(opts?): Engine`

`{ lookAhead? (0.3 s), masterVolumeDb? (-6) }`. Tone.js and the presets are imported
inside `unlock()`; call it from a user gesture. Sounds and buses created before
unlock are materialized after it (continuous sounds resume their last `start`/`set`,
one-shot plays before unlock are dropped). `visibilitychange` back to visible
resumes a suspended context; failure sets `status = 'suspended'`.

Bus graph: `sound → Gain(volume dB) → Panner → mute Gain → master Gain → destination`.

### Presets

`catalog` (id, kind, metaphor, use), `presetIds`, `presetRate` (Hz range per
continuous preset), `defaultLevelSounds`. Factories are available after unlock
through the lazily loaded `presets` module; refer to them by id.

### `fromSpec(spec: SynthSpec, ctx: SoundContext)` — `@earcon/engine-tone/from-spec`

Interprets a `SynthSpec`. It imports Tone statically, so it lives behind a subpath;
the main entry stays Tone-free and reaches it lazily for `{ kind: 'synth' }` specs. `specs/<name>.json` ships SynthSpec twins of `sonar`,
`parkingSensor`, `heartbeat`, `coin`, `chime`, `knock`
(`import spec from '@earcon/engine-tone/specs/sonar'`).

## `@earcon/react`

### `<NotifierProvider engine sounds? transitions? policy? tickIntervalSec? staleRepeatSec?>`

| prop | default |
| --- | --- |
| `sounds` | `{ watch: sonar, warn: parkingSensor, critical: hiLoSiren }` |
| `transitions` | `{ toSafe: allClear, stale: knock }` (no `escalate`) |
| `policy` | `{ mode: 'worst-only' }` |
| `tickIntervalSec` | `1` (remount to change) |
| `staleRepeatSec` | `10` |

On the server it renders children and never touches the engine.

### `useMonitor(opts): { state, update(value, t?), acknowledge() }`

`opts` = `MonitorOptions` + `sounds?` (per-monitor override) + `pan?` + `volume?` +
`onEvent?(events, state)`. The monitor is recreated only when `id` changes; other
option changes are ignored until then. `update` is synchronous; React state is
delivered through `useSyncExternalStore`, so calling `update` does not itself
schedule a render of anything but subscribers of that monitor. `t` defaults to
`performance.now()`.

### `useToneNotifier(): { status, unlock, resume, muted, setMuted, setMasterVolume, acknowledgeAll }`

### `<UnlockGate>{({ status, unlock, resume }) => …}</UnlockGate>` and `<UnlockGate.Default />`

Headless render prop; the default renders a button while `locked` / `suspended`, a
short text when `unavailable`, nothing when `ready`. Styled only through CSS
variables (`--earcon-font`, `--earcon-fg`, `--earcon-bg`, `--earcon-border`,
`--earcon-radius`, `--earcon-padding`, `--earcon-fg-muted`, `--earcon-small`).

### Wiring (what sounds when)

After every event batch the provider recomputes `selectAudible` and reconciles the
continuous sounds: selected monitors play their level sound at the current
intensity; deselected, safe, acknowledged or stale monitors are silent. One-shots:
`escalate` on promotion, `toSafe` when leaving to the safe zone, `stale` on stale
and every `staleRepeatSec` until samples resume (also while acknowledged).
