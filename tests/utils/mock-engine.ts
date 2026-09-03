import type { Bus, ContinuousSound, Engine, EngineStatus, OneShotSound, SoundSpec } from '@earcon/core'

/**
 * Recording Engine for @earcon/react wiring tests (spec §5.5). No audio: every
 * call lands in `log` as a string, and `tick(nowMs)` drives scheduleRepeat by hand.
 */
export interface MockEngine extends Engine {
  log: string[]
  ticks: Array<{ cb: (nowMs: number) => void; intervalSec: number; cancelled: boolean }>
  tick(nowMs: number): void
  setStatus(status: EngineStatus): void
  /** Sound instances by their `spec` id/kind and bus id. */
  continuous: Map<string, ContinuousSound & { started: boolean; intensity: number }>
  oneShots: Map<string, OneShotSound & { plays: number }>
}

const specKey = (spec: SoundSpec) => (spec.kind === 'preset' ? spec.id : spec.kind === 'synth' ? `synth:${spec.voice}` : 'custom')

export function createMockEngine(initial: EngineStatus = 'ready'): MockEngine {
  const log: string[] = []
  const listeners = new Set<(s: EngineStatus) => void>()
  let status = initial
  const ticks: MockEngine['ticks'] = []
  const continuous = new Map<string, ContinuousSound & { started: boolean; intensity: number }>()
  const oneShots = new Map<string, OneShotSound & { plays: number }>()

  return {
    log,
    ticks,
    continuous,
    oneShots,
    get status() {
      return status
    },
    setStatus(s) {
      status = s
      for (const cb of listeners) cb(s)
    },
    tick(nowMs) {
      for (const t of ticks) if (!t.cancelled) t.cb(nowMs)
    },
    async unlock() {
      log.push('unlock')
      this.setStatus('ready')
    },
    async resume() {
      log.push('resume')
      this.setStatus('ready')
    },
    setMasterVolume(db) {
      log.push(`master:${db}`)
    },
    setMuted(m) {
      log.push(`muted:${m}`)
    },
    createBus(id, opts) {
      log.push(`bus:${id}:create(pan=${opts?.pan ?? 0},vol=${opts?.volume ?? 0})`)
      const bus: Bus = {
        id,
        setPan: (p) => log.push(`bus:${id}:pan=${p}`),
        setVolume: (v) => log.push(`bus:${id}:vol=${v}`),
        dispose: () => log.push(`bus:${id}:dispose`),
      }
      return bus
    },
    createContinuous(spec, bus) {
      const key = `${bus.id}/${specKey(spec)}`
      log.push(`cont:${key}:create`)
      const sound = {
        started: false,
        intensity: 0,
        start(i: number) {
          this.started = true
          this.intensity = i
          log.push(`cont:${key}:start(${round(i)})`)
        },
        set(i: number) {
          this.intensity = i
          log.push(`cont:${key}:set(${round(i)})`)
        },
        stop() {
          this.started = false
          log.push(`cont:${key}:stop`)
        },
        dispose() {
          log.push(`cont:${key}:dispose`)
        },
      }
      continuous.set(key, sound)
      return sound
    },
    createOneShot(spec, bus) {
      const key = `${bus.id}/${specKey(spec)}`
      log.push(`shot:${key}:create`)
      const sound = {
        plays: 0,
        play(o?: { transpose?: number }) {
          this.plays++
          log.push(`shot:${key}:play${o?.transpose ? `(+${o.transpose})` : ''}`)
        },
        dispose() {
          log.push(`shot:${key}:dispose`)
        },
      }
      oneShots.set(key, sound)
      return sound
    },
    scheduleRepeat(cb, intervalSec) {
      const entry = { cb, intervalSec, cancelled: false }
      ticks.push(entry)
      log.push(`repeat:${intervalSec}`)
      return () => {
        entry.cancelled = true
        log.push('repeat:cancel')
      }
    },
    onStatusChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    dispose() {
      log.push('engine:dispose')
    },
  }
}

const round = (x: number) => Math.round(x * 1000) / 1000
