import {
  createMonitor,
  selectAudible,
  type ArbiterPolicy,
  type Bus,
  type ContinuousSound,
  type Engine,
  type Monitor,
  type MonitorEvent,
  type MonitorOptions,
  type MonitorState,
  type OneShotSound,
  type SoundSpec,
} from '@earcon/core'

export interface TransitionSounds {
  toSafe?: SoundSpec
  stale?: SoundSpec
  escalate?: SoundSpec
}

export interface NotifierConfig {
  engine: Engine
  /** Level id → continuous sound. Default: watch/warn/critical presets (ADR-0001 §16). */
  sounds?: Record<string, SoundSpec>
  transitions?: TransitionSounds
  /** Default `worst-only`. */
  policy?: ArbiterPolicy
  /** Default 1. */
  tickIntervalSec?: number
  /** Default 10. */
  staleRepeatSec?: number
}

export interface MonitorExtras {
  /** Overrides the provider's `sounds` for this monitor only. */
  sounds?: Partial<Record<string, SoundSpec>>
  pan?: number
  volume?: number
  /** Called with every event batch (update, tick, acknowledge). */
  onEvent?: (events: MonitorEvent[], state: MonitorState) => void
}

export interface NotifierStore {
  configure(patch: Omit<NotifierConfig, 'engine'>): void
  addMonitor(opts: MonitorOptions, extras?: MonitorExtras): void
  removeMonitor(id: string): void
  update(id: string, value: number, t: number): void
  acknowledge(id: string): void
  acknowledgeAll(): void
  getState(id: string): MonitorState
  subscribe(id: string, cb: () => void): () => void
  /** Start the watchdog tick loop (idempotent). Called at creation and by the provider's effect. */
  start(): void
  /** Stop the tick loop; `start()` resumes it. Survives React StrictMode's mount/unmount/mount. */
  stop(): void
  /** stop() + remove every monitor. */
  dispose(): void
}

export const DEFAULT_SOUNDS: Record<string, SoundSpec> = {
  watch: { kind: 'preset', id: 'sonar' },
  warn: { kind: 'preset', id: 'parkingSensor' },
  critical: { kind: 'preset', id: 'hiLoSiren' },
}

export const DEFAULT_TRANSITIONS: TransitionSounds = {
  toSafe: { kind: 'preset', id: 'allClear' },
  stale: { kind: 'preset', id: 'knock' },
}

export function initialMonitorState(id: string): MonitorState {
  return { id, level: null, stale: false, intensity: 0, eta: null, velocity: 0, acknowledged: false, lastSample: null }
}

interface Entry {
  monitor: Monitor
  opts: MonitorOptions
  extras: MonitorExtras
  bus: Bus
  sounds: Record<string, SoundSpec>
  continuous: Map<string, ContinuousSound>
  oneShots: Map<keyof TransitionSounds, OneShotSound>
  /** The level sound currently started, if any. */
  playing: { level: string; sound: ContinuousSound; intensity: number } | null
  /** When the stale one-shot last played (Sample.t axis); null while not stale. */
  staleLastMs: number | null
}

export function createNotifierStore(initial: NotifierConfig): NotifierStore {
  const engine = initial.engine
  let sounds = initial.sounds ?? DEFAULT_SOUNDS
  let transitions = initial.transitions ?? DEFAULT_TRANSITIONS
  let policy: ArbiterPolicy = initial.policy ?? { mode: 'worst-only' }
  const tickIntervalSec = initial.tickIntervalSec ?? 1
  let staleRepeatSec = initial.staleRepeatSec ?? 10

  const entries = new Map<string, Entry>()
  const listeners = new Map<string, Set<() => void>>()
  /** Stable placeholder states for ids without a monitor (useSyncExternalStore needs identity). */
  const placeholders = new Map<string, MonitorState>()

  let cancelTick: (() => void) | null = null
  function start() {
    if (cancelTick) return
    cancelTick = engine.scheduleRepeat((nowMs) => {
      for (const [id, entry] of entries) {
        const events = entry.monitor.tick(nowMs)
        if (events.length) handle(id, entry, events, nowMs)
        repeatStale(entry, nowMs)
      }
    }, tickIntervalSec)
  }
  function stop() {
    cancelTick?.()
    cancelTick = null
  }
  start()

  // ---------------------------------------------------------------- helpers

  function notify(id: string) {
    const set = listeners.get(id)
    if (set) for (const cb of set) cb()
  }

  function levelIndexOf(state: MonitorState): number {
    if (state.level === null) return -1
    const entry = entries.get(state.id)
    return entry ? entry.opts.levels.findIndex((l) => l.id === state.level) : -1
  }

  function levelSound(entry: Entry, level: string): ContinuousSound | null {
    const cached = entry.continuous.get(level)
    if (cached) return cached
    const spec = entry.sounds[level]
    if (!spec) return null
    const sound = engine.createContinuous(spec, entry.bus)
    entry.continuous.set(level, sound)
    return sound
  }

  function oneShot(entry: Entry, kind: keyof TransitionSounds): OneShotSound | null {
    const cached = entry.oneShots.get(kind)
    if (cached) return cached
    const spec = transitions[kind]
    if (!spec) return null
    const sound = engine.createOneShot(spec, entry.bus)
    entry.oneShots.set(kind, sound)
    return sound
  }

  function stopPlaying(entry: Entry) {
    if (!entry.playing) return
    entry.playing.sound.stop()
    entry.playing = null
  }

  /** Bring every monitor's continuous sound in line with the arbiter's selection. */
  function sync() {
    const states = [...entries.values()].map((e) => e.monitor.state)
    const audible = new Set(selectAudible(states, levelIndexOf, policy))
    for (const [id, entry] of entries) {
      const state = entry.monitor.state
      const wantLevel = audible.has(id) ? state.level : null
      if (wantLevel === null) {
        stopPlaying(entry)
        continue
      }
      const sound = levelSound(entry, wantLevel)
      if (!sound) {
        stopPlaying(entry)
        continue
      }
      if (entry.playing && entry.playing.sound !== sound) stopPlaying(entry)
      if (!entry.playing) {
        sound.start(state.intensity)
        entry.playing = { level: wantLevel, sound, intensity: state.intensity }
      } else if (entry.playing.intensity !== state.intensity) {
        sound.set(state.intensity)
        entry.playing.intensity = state.intensity
      }
    }
  }

  function handle(id: string, entry: Entry, events: MonitorEvent[], nowMs: number) {
    for (const event of events) {
      switch (event.type) {
        case 'enter': {
          const from = event.from === null ? -1 : entry.opts.levels.findIndex((l) => l.id === event.from)
          const to = entry.opts.levels.findIndex((l) => l.id === event.level)
          if (to > from) oneShot(entry, 'escalate')?.play()
          break
        }
        case 'exit':
          if (event.to === null) oneShot(entry, 'toSafe')?.play()
          break
        case 'stale':
          oneShot(entry, 'stale')?.play()
          entry.staleLastMs = nowMs
          break
        case 'resume':
          entry.staleLastMs = null
          break
        default:
          break
      }
    }
    sync()
    entry.extras.onEvent?.(events, entry.monitor.state)
    notify(id)
  }

  function repeatStale(entry: Entry, nowMs: number) {
    if (entry.staleLastMs === null || !entry.monitor.state.stale) return
    if (nowMs - entry.staleLastMs < staleRepeatSec * 1000) return
    oneShot(entry, 'stale')?.play()
    entry.staleLastMs = nowMs
  }

  // ---------------------------------------------------------------- api

  return {
    configure(patch) {
      if (patch.sounds !== undefined) sounds = patch.sounds
      if (patch.transitions !== undefined) transitions = patch.transitions
      if (patch.policy !== undefined) policy = patch.policy
      if (patch.staleRepeatSec !== undefined) staleRepeatSec = patch.staleRepeatSec
      for (const entry of entries.values()) entry.sounds = merge(sounds, entry.extras.sounds)
      sync()
    },
    addMonitor(opts, extras = {}) {
      if (entries.has(opts.id)) this.removeMonitor(opts.id)
      const busOpts: { pan?: number; volume?: number } = {}
      if (extras.pan !== undefined) busOpts.pan = extras.pan
      if (extras.volume !== undefined) busOpts.volume = extras.volume
      entries.set(opts.id, {
        monitor: createMonitor(opts),
        opts,
        extras,
        bus: engine.createBus(opts.id, busOpts),
        sounds: merge(sounds, extras.sounds),
        continuous: new Map(),
        oneShots: new Map(),
        playing: null,
        staleLastMs: null,
      })
      notify(opts.id)
    },
    removeMonitor(id) {
      const entry = entries.get(id)
      if (!entry) return
      stopPlaying(entry)
      for (const s of entry.continuous.values()) s.dispose()
      for (const s of entry.oneShots.values()) s.dispose()
      entry.bus.dispose()
      entries.delete(id)
      sync()
      notify(id)
    },
    update(id, value, t) {
      const entry = entries.get(id)
      if (!entry) return
      const events = entry.monitor.update({ value, t })
      if (events.length) handle(id, entry, events, t)
    },
    acknowledge(id) {
      const entry = entries.get(id)
      if (!entry) return
      const events = entry.monitor.acknowledge()
      if (events.length) handle(id, entry, events, entry.monitor.state.lastSample?.t ?? 0)
    },
    acknowledgeAll() {
      for (const id of entries.keys()) this.acknowledge(id)
    },
    getState(id) {
      const entry = entries.get(id)
      if (entry) return entry.monitor.state
      let placeholder = placeholders.get(id)
      if (!placeholder) {
        placeholder = initialMonitorState(id)
        placeholders.set(id, placeholder)
      }
      return placeholder
    },
    subscribe(id, cb) {
      let set = listeners.get(id)
      if (!set) {
        set = new Set()
        listeners.set(id, set)
      }
      set.add(cb)
      return () => {
        set.delete(cb)
        if (set.size === 0) listeners.delete(id)
      }
    },
    start,
    stop,
    dispose() {
      stop()
      for (const id of [...entries.keys()]) this.removeMonitor(id)
    },
  }
}

function merge(base: Record<string, SoundSpec>, override?: Partial<Record<string, SoundSpec>>): Record<string, SoundSpec> {
  const out: Record<string, SoundSpec> = { ...base }
  for (const [k, v] of Object.entries(override ?? {})) if (v) out[k] = v
  return out
}
