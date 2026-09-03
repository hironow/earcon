import { describe, expect, test } from 'bun:test'
import { createMonitor } from './monitor'
import type { Level, MonitorEvent, MonitorOptions } from './types'

// Liquidation-distance style monitor: value shrinking toward 0 is dangerous.
const watch: Level = { id: 'watch', enter: 0.1, exit: 0.12 }
const warn: Level = { id: 'warn', enter: 0.05, exit: 0.06 }
const critical: Level = { id: 'critical', enter: 0.02, exit: 0.03 }

const base: MonitorOptions = { id: 'm', direction: 'decreasing', levels: [watch, warn, critical] }

/** Feed values one second apart starting at t=0; returns events per sample. */
function feed(monitor: ReturnType<typeof createMonitor>, values: number[], stepMs = 1000) {
  return values.map((value, i) => monitor.update({ value, t: i * stepMs }))
}

const transitions = (events: MonitorEvent[]) =>
  events.filter((e) => e.type === 'enter' || e.type === 'exit')

describe('createMonitor: level transitions', () => {
  test('T1 hysteresis: enters at .10, exits at .12, does not re-enter at .119', () => {
    const m = createMonitor({ ...base, levels: [watch] })
    const [e15, e10, e11, e12, e119] = feed(m, [0.15, 0.1, 0.11, 0.12, 0.119])
    expect(transitions(e15!)).toEqual([])
    expect(transitions(e10!)).toEqual([{ type: 'enter', level: 'watch', from: null }])
    expect(transitions(e11!)).toEqual([])
    expect(transitions(e12!)).toEqual([{ type: 'exit', level: 'watch', to: null }])
    expect(transitions(e119!)).toEqual([])
    expect(m.state.level).toBeNull()
  })

  test('T2 skips intermediate levels: .15 → .01 emits only enter{critical, from: null}', () => {
    const m = createMonitor(base)
    const [, events] = feed(m, [0.15, 0.01])
    expect(transitions(events!)).toEqual([{ type: 'enter', level: 'critical', from: null }])
    expect(m.state.level).toBe('critical')
  })

  test('T3 demotion only via the current level exit: critical stays at .025 (no enter/exit events)', () => {
    const m = createMonitor(base)
    const [, , events] = feed(m, [0.15, 0.01, 0.025])
    expect(transitions(events!)).toEqual([])
    expect(m.state.level).toBe('critical')
  })

  test('T4 demotion target: critical{exit .03} at .04 → exit{critical, to: warn} + enter{warn, from: critical}', () => {
    const m = createMonitor(base)
    const [, , events] = feed(m, [0.15, 0.01, 0.04])
    expect(transitions(events!)).toEqual([
      { type: 'exit', level: 'critical', to: 'warn' },
      { type: 'enter', level: 'warn', from: 'critical' },
    ])
    expect(m.state.level).toBe('warn')
  })

  test('demotion straight to safe when no lower level matches', () => {
    const m = createMonitor(base)
    const [, , events] = feed(m, [0.15, 0.01, 0.2])
    expect(transitions(events!)).toEqual([{ type: 'exit', level: 'critical', to: null }])
    expect(m.state.level).toBeNull()
  })
})

describe('createMonitor: intensity (value mode)', () => {
  test('T5 iValue: warn band [.05, .02) at .035 → intensity 0.5', () => {
    const m = createMonitor(base)
    feed(m, [0.15, 0.035])
    expect(m.state.intensity).toBeCloseTo(0.5, 6)
  })

  test('top level band reuses the previous band width: critical at .005 → (0.02-0.005)/0.03', () => {
    const m = createMonitor(base)
    feed(m, [0.15, 0.005])
    expect(m.state.intensity).toBeCloseTo(0.015 / 0.03, 6)
  })

  test('single level band width is |enter - exit| * 4 (spec provisional)', () => {
    const m = createMonitor({ ...base, levels: [watch] })
    // band width = 0.02 * 4 = 0.08; at .06, (0.10 - 0.06) / 0.08 = 0.5
    feed(m, [0.15, 0.06])
    expect(m.state.intensity).toBeCloseTo(0.5, 6)
  })

  test('intensity is 0 in the safe zone and clamps to [0, 1]', () => {
    const m = createMonitor(base)
    feed(m, [0.5])
    expect(m.state.intensity).toBe(0)
    feed(m, [0.5, -0.02]) // critical band width 0.03; (0.02 + 0.02) / 0.03 > 1
    expect(m.state.intensity).toBe(1)
  })

  test('intensity event fires only when the value changes by >= 1e-3', () => {
    const m = createMonitor(base)
    const [, e1, e2, e3] = feed(m, [0.15, 0.035, 0.03501, 0.032])
    const first = e1!.filter((e) => e.type === 'intensity')
    expect(first).toHaveLength(1)
    expect(first[0]).toEqual({ type: 'intensity', value: expect.closeTo(0.5, 9) })
    expect(e2!.filter((e) => e.type === 'intensity')).toEqual([])
    expect(e3!.filter((e) => e.type === 'intensity')).toHaveLength(1)
  })
})

describe('createMonitor: velocity and ETA', () => {
  const eta: MonitorOptions = { ...base, urgency: { mode: 'eta', eventAt: 0, horizonSec: 300 } }

  test('T6 constant approach: .10 → .09 → .08 at 1s → velocity ≈ 0.01/s, eta ≈ 8s, iEta = 1 - log10(8)/log10(300)', () => {
    const m = createMonitor(eta)
    feed(m, [0.1, 0.09, 0.08])
    expect(m.state.velocity).toBeCloseTo(0.01, 9)
    expect(m.state.eta).toBeCloseTo(8, 6)
    const iEta = 1 - Math.log10(8) / Math.log10(300)
    expect(m.state.intensity).toBeCloseTo(iEta, 9)
  })

  test('T7 moving away: approach 0, eta Infinity, iEta 0', () => {
    const m = createMonitor(eta)
    feed(m, [0.08, 0.09, 0.1])
    expect(m.state.velocity).toBeLessThan(0)
    expect(m.state.eta).toBe(Number.POSITIVE_INFINITY)
    // watch band [.10, .05): at .10 iValue = 0, so intensity is purely iEta
    expect(m.state.intensity).toBe(0)
  })

  test('T8 irregular dt EMA: alpha = 1 - exp(-dt / tau) for dt 1s then 5s', () => {
    const m = createMonitor({ ...eta, velocityWindowMs: 10_000 })
    m.update({ value: 0.1, t: 0 })
    m.update({ value: 0.09, t: 1000 }) // raw 0.01, ema initialized to 0.01
    m.update({ value: 0.06, t: 6000 }) // raw 0.03/5 = 0.006
    const alpha = 1 - Math.exp(-5 / 10)
    expect(m.state.velocity).toBeCloseTo(0.01 + alpha * (0.006 - 0.01), 12)
  })

  test('T8 (value mode) velocity follows the same EMA path; eta stays null', () => {
    const m = createMonitor({ ...base, velocityWindowMs: 10_000 })
    m.update({ value: 0.1, t: 0 })
    m.update({ value: 0.09, t: 1000 })
    m.update({ value: 0.06, t: 6000 })
    const alpha = 1 - Math.exp(-5 / 10)
    expect(m.state.velocity).toBeCloseTo(0.01 + alpha * (0.006 - 0.01), 12)
    expect(m.state.eta).toBeNull()
  })

  test('eta and velocity are reported in the safe zone while intensity stays 0', () => {
    const m = createMonitor(eta)
    feed(m, [0.5, 0.4, 0.3])
    expect(m.state.level).toBeNull()
    expect(m.state.intensity).toBe(0)
    expect(m.state.velocity).toBeCloseTo(0.1, 9)
    expect(m.state.eta).toBeCloseTo(3, 6)
  })

  test('T9 dt <= 0: second update at the same t returns [] and leaves state unchanged', () => {
    const m = createMonitor(eta)
    m.update({ value: 0.1, t: 0 })
    m.update({ value: 0.09, t: 1000 })
    const before = structuredClone(m.state)
    expect(m.update({ value: 0.01, t: 1000 })).toEqual([])
    expect(m.update({ value: 0.01, t: 999 })).toEqual([])
    expect(m.state).toEqual(before)
  })
})

describe('createMonitor: watchdog', () => {
  test('T10 stale after staleAfterMs: tick(t + 15001) emits stale and keeps the level', () => {
    const m = createMonitor({ ...base, staleAfterMs: 15_000 })
    m.update({ value: 0.04, t: 0 })
    expect(m.tick(15_000)).toEqual([])
    expect(m.tick(15_001)).toEqual([{ type: 'stale' }])
    expect(m.state.stale).toBe(true)
    expect(m.state.level).toBe('warn')
    expect(m.tick(20_000)).toEqual([])
  })

  test('T11 resume: the next update emits resume first, then normal transitions', () => {
    const m = createMonitor({ ...base, staleAfterMs: 15_000 })
    m.update({ value: 0.04, t: 0 })
    m.tick(15_001)
    const events = m.update({ value: 0.01, t: 16_000 })
    expect(events[0]).toEqual({ type: 'resume' })
    expect(transitions(events)).toEqual([{ type: 'enter', level: 'critical', from: 'warn' }])
    expect(m.state.stale).toBe(false)
  })

  test('T12 never-sampled monitor does not go stale', () => {
    const m = createMonitor({ ...base, staleAfterMs: 15_000 })
    expect(m.tick(1_000_000)).toEqual([])
    expect(m.state.stale).toBe(false)
  })

  test('staleAfterMs: 0 disables the watchdog', () => {
    const m = createMonitor({ ...base, staleAfterMs: 0 })
    m.update({ value: 0.04, t: 0 })
    expect(m.tick(1_000_000)).toEqual([])
  })

  test('dt <= 0 while stale is ignored: no resume', () => {
    const m = createMonitor({ ...base, staleAfterMs: 15_000 })
    m.update({ value: 0.04, t: 0 })
    m.tick(15_001)
    expect(m.update({ value: 0.01, t: 0 })).toEqual([])
    expect(m.state.stale).toBe(true)
  })
})

describe('createMonitor: acknowledge', () => {
  test('T13 ack cleared on escalate: ack-cleared{escalate} precedes enter', () => {
    const m = createMonitor(base)
    feed(m, [0.15, 0.04])
    expect(m.acknowledge()).toEqual([{ type: 'ack' }])
    expect(m.state.acknowledged).toBe(true)
    const events = m.update({ value: 0.01, t: 2000 })
    const idxCleared = events.findIndex((e) => e.type === 'ack-cleared')
    const idxEnter = events.findIndex((e) => e.type === 'enter')
    expect(events[idxCleared]).toEqual({ type: 'ack-cleared', reason: 'escalate' })
    expect(idxCleared).toBeLessThan(idxEnter)
    expect(m.state.acknowledged).toBe(false)
  })

  test('T14 ack cleared on exit (ackScope level): warn → watch emits ack-cleared{exit}', () => {
    const m = createMonitor({ ...base, ackScope: 'level' })
    feed(m, [0.15, 0.04])
    m.acknowledge()
    const events = m.update({ value: 0.08, t: 2000 })
    expect(events).toEqual([
      { type: 'exit', level: 'warn', to: 'watch' },
      { type: 'ack-cleared', reason: 'exit' },
      { type: 'enter', level: 'watch', from: 'warn' },
      { type: 'intensity', value: expect.any(Number) },
    ])
    expect(m.state.acknowledged).toBe(false)
  })

  test('T15 ackScope until-safe: survives warn → watch, cleared on return to safe', () => {
    const m = createMonitor({ ...base, ackScope: 'until-safe' })
    feed(m, [0.15, 0.04])
    m.acknowledge()
    const demote = m.update({ value: 0.08, t: 2000 })
    expect(demote.some((e) => e.type === 'ack-cleared')).toBe(false)
    expect(m.state.acknowledged).toBe(true)
    const safe = m.update({ value: 0.2, t: 3000 })
    expect(safe).toContainEqual({ type: 'ack-cleared', reason: 'exit' })
    expect(m.state.acknowledged).toBe(false)
  })

  test('T16 acknowledge in the safe zone is a no-op', () => {
    const m = createMonitor(base)
    feed(m, [0.15])
    expect(m.acknowledge()).toEqual([])
    expect(m.state.acknowledged).toBe(false)
  })

  test('acknowledge twice is a no-op the second time', () => {
    const m = createMonitor(base)
    feed(m, [0.15, 0.04])
    m.acknowledge()
    expect(m.acknowledge()).toEqual([])
  })

  test('intensity events keep flowing while acknowledged', () => {
    const m = createMonitor(base)
    feed(m, [0.15, 0.04])
    m.acknowledge()
    const events = m.update({ value: 0.035, t: 2000 })
    expect(events.some((e) => e.type === 'intensity')).toBe(true)
  })
})

describe('createMonitor: options validation and reset', () => {
  test('T17 exit on the dangerous side of enter throws', () => {
    expect(() =>
      createMonitor({ ...base, levels: [{ id: 'watch', enter: 0.1, exit: 0.08 }] }),
    ).toThrow(/exit/)
    expect(() =>
      createMonitor({ id: 'x', direction: 'increasing', levels: [{ id: 'hot', enter: 80, exit: 90 }] }),
    ).toThrow(/exit/)
  })

  test('horizonSec must be > 1 (log10(1) = 0), staleAfterMs >= 0, velocityWindowMs > 0', () => {
    expect(() => createMonitor({ ...base, urgency: { mode: 'eta', eventAt: 0, horizonSec: 1 } })).toThrow(/horizonSec/)
    expect(() => createMonitor({ ...base, urgency: { mode: 'eta', eventAt: 0, horizonSec: -5 } })).toThrow(/horizonSec/)
    expect(() => createMonitor({ ...base, staleAfterMs: -1 })).toThrow(/staleAfterMs/)
    expect(() => createMonitor({ ...base, velocityWindowMs: 0 })).toThrow(/velocityWindowMs/)
    expect(() => createMonitor({ ...base, urgency: { mode: 'eta', eventAt: 0, horizonSec: 1.5 } })).not.toThrow()
  })

  test('empty levels throws', () => {
    expect(() => createMonitor({ ...base, levels: [] })).toThrow(/levels/)
  })

  test('increasing direction: enter when the value rises past enter', () => {
    const m = createMonitor({ id: 'temp', direction: 'increasing', levels: [{ id: 'hot', enter: 80, exit: 70 }] })
    const [, e80, e75, e70] = feed(m, [50, 80, 75, 70])
    expect(transitions(e80!)).toEqual([{ type: 'enter', level: 'hot', from: null }])
    expect(transitions(e75!)).toEqual([])
    expect(transitions(e70!)).toEqual([{ type: 'exit', level: 'hot', to: null }])
  })

  test('state exposes id and lastSample', () => {
    const m = createMonitor(base)
    expect(m.state.id).toBe('m')
    expect(m.state.lastSample).toBeNull()
    m.update({ value: 0.04, t: 5 })
    expect(m.state.lastSample).toEqual({ value: 0.04, t: 5 })
  })

  test('reset returns to the initial state without events', () => {
    const m = createMonitor({ ...base, urgency: { mode: 'eta', eventAt: 0 } })
    feed(m, [0.15, 0.04, 0.03])
    m.acknowledge()
    m.reset()
    expect(m.state).toEqual({
      id: 'm',
      level: null,
      stale: false,
      intensity: 0,
      eta: null,
      velocity: 0,
      acknowledged: false,
      lastSample: null,
    })
    expect(m.update({ value: 0.04, t: 0 }).some((e) => e.type === 'enter')).toBe(true)
  })
})
