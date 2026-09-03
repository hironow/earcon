import { beforeEach, describe, expect, test } from 'bun:test'
import type { Level } from '@earcon/core'
import { createMockEngine, type MockEngine } from '../../../tests/utils/mock-engine'
import { createNotifierStore, type NotifierStore } from './store'

const levels: Level[] = [
  { id: 'watch', enter: 0.1, exit: 0.12 },
  { id: 'warn', enter: 0.05, exit: 0.06 },
  { id: 'critical', enter: 0.02, exit: 0.03 },
]

let engine: MockEngine
let store: NotifierStore

const cont = (bus: string, id: string) => engine.continuous.get(`${bus}/${id}`)!
const since = (mark: number) => engine.log.slice(mark)

beforeEach(() => {
  engine = createMockEngine('ready')
  store = createNotifierStore({
    engine,
    sounds: { watch: { kind: 'preset', id: 'sonar' }, warn: { kind: 'preset', id: 'parkingSensor' }, critical: { kind: 'preset', id: 'hiLoSiren' } },
    transitions: { toSafe: { kind: 'preset', id: 'allClear' }, stale: { kind: 'preset', id: 'knock' }, escalate: { kind: 'preset', id: 'bell' } },
    policy: { mode: 'worst-only' },
    tickIntervalSec: 1,
    staleRepeatSec: 10,
  })
})

describe('NotifierStore wiring (spec §5.4 / §5.5)', () => {
  test('enter starts the level sound with the current intensity; escalate one-shot plays', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels })
    store.update('a', 0.15, 0)
    expect(engine.log.filter((l) => l.startsWith('cont:'))).toEqual([])
    store.update('a', 0.035, 1000)
    expect(cont('a', 'parkingSensor').started).toBe(true)
    expect(cont('a', 'parkingSensor').intensity).toBeCloseTo(0.5, 6)
    expect(engine.oneShots.get('a/bell')!.plays).toBe(1)
  })

  test('intensity events call set() on the playing level sound', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels })
    store.update('a', 0.035, 0)
    const mark = engine.log.length
    store.update('a', 0.032, 1000)
    expect(since(mark)).toEqual(['cont:a/parkingSensor:set(0.6)'])
  })

  test('acknowledge stops the sound; intensity keeps flowing silently; ack-cleared on escalate restarts', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels })
    store.update('a', 0.035, 0)
    store.acknowledge('a')
    expect(cont('a', 'parkingSensor').started).toBe(false)
    const mark = engine.log.length
    store.update('a', 0.032, 1000)
    expect(since(mark)).toEqual([])
    store.update('a', 0.01, 2000)
    expect(cont('a', 'parkingSensor').started).toBe(false)
    expect(cont('a', 'hiLoSiren').started).toBe(true)
    expect(store.getState('a').acknowledged).toBe(false)
  })

  test('stale stops the sound and repeats the stale one-shot every staleRepeatSec; resume restores the level sound', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels, staleAfterMs: 15_000 })
    store.update('a', 0.035, 0)
    engine.tick(15_001)
    expect(cont('a', 'parkingSensor').started).toBe(false)
    expect(engine.oneShots.get('a/knock')!.plays).toBe(1)
    engine.tick(20_000)
    expect(engine.oneShots.get('a/knock')!.plays).toBe(1)
    engine.tick(25_001)
    expect(engine.oneShots.get('a/knock')!.plays).toBe(2)
    engine.tick(35_001)
    expect(engine.oneShots.get('a/knock')!.plays).toBe(3)
    store.update('a', 0.035, 36_000)
    expect(store.getState('a').stale).toBe(false)
    expect(cont('a', 'parkingSensor').started).toBe(true)
    engine.tick(50_000)
    expect(engine.oneShots.get('a/knock')!.plays).toBe(3)
  })

  test('stale one-shot keeps repeating while acknowledged (ADR-0001 §14)', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels, staleAfterMs: 15_000 })
    store.update('a', 0.035, 0)
    store.acknowledge('a')
    engine.tick(15_001)
    engine.tick(25_001)
    expect(engine.oneShots.get('a/knock')!.plays).toBe(2)
  })

  test('worst-only: the second monitor at a lower level stays silent until it becomes the worst', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels })
    store.addMonitor({ id: 'b', direction: 'decreasing', levels })
    store.update('a', 0.035, 0) // warn
    store.update('b', 0.08, 0) // watch
    expect(cont('a', 'parkingSensor').started).toBe(true)
    expect(engine.continuous.has('b/sonar')).toBe(false)
    store.update('b', 0.01, 1000) // critical → b is now the worst
    expect(cont('b', 'hiLoSiren').started).toBe(true)
    expect(cont('a', 'parkingSensor').started).toBe(false)
    const mark = engine.log.length
    store.update('a', 0.032, 2000) // a's intensity changes but it is not audible
    expect(since(mark).filter((l) => l.includes('set('))).toEqual([])
  })

  test('policy all: every monitor in a level sounds', () => {
    store.configure({ policy: { mode: 'all' } })
    store.addMonitor({ id: 'a', direction: 'decreasing', levels })
    store.addMonitor({ id: 'b', direction: 'decreasing', levels })
    store.update('a', 0.035, 0)
    store.update('b', 0.08, 0)
    expect(cont('a', 'parkingSensor').started).toBe(true)
    expect(cont('b', 'sonar').started).toBe(true)
  })

  test('exit to safe stops the sound and plays toSafe; demotion swaps sounds without escalate', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels })
    store.update('a', 0.01, 0)
    expect(engine.oneShots.get('a/bell')!.plays).toBe(1)
    store.update('a', 0.04, 1000) // critical → warn
    expect(cont('a', 'hiLoSiren').started).toBe(false)
    expect(cont('a', 'parkingSensor').started).toBe(true)
    expect(engine.oneShots.get('a/bell')!.plays).toBe(1)
    store.update('a', 0.2, 2000) // → safe
    expect(cont('a', 'parkingSensor').started).toBe(false)
    expect(engine.oneShots.get('a/allClear')!.plays).toBe(1)
  })

  test('removeMonitor disposes bus and sounds and clears stale repeats', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels, staleAfterMs: 15_000 })
    store.update('a', 0.035, 0)
    engine.tick(15_001)
    store.removeMonitor('a')
    expect(engine.log).toContain('cont:a/parkingSensor:dispose')
    expect(engine.log).toContain('shot:a/knock:dispose')
    expect(engine.log).toContain('bus:a:dispose')
    const plays = engine.oneShots.get('a/knock')!.plays
    engine.tick(25_001)
    expect(engine.oneShots.get('a/knock')!.plays).toBe(plays)
    expect(store.getState('a').level).toBeNull()
  })

  test('monitor-level sounds override provider sounds; levels without a sound stay silent', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels }, { sounds: { warn: { kind: 'preset', id: 'geiger' } } })
    store.update('a', 0.035, 0)
    expect(cont('a', 'geiger').started).toBe(true)
    store.configure({ sounds: { warn: { kind: 'preset', id: 'parkingSensor' } } })
    store.addMonitor({ id: 'b', direction: 'decreasing', levels })
    store.update('b', 0.01, 0) // critical, no sound configured
    expect([...engine.continuous.keys()].filter((k) => k.startsWith('b/'))).toEqual([])
  })

  test('bus pan and volume are passed to the engine', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels }, { pan: -1, volume: -3 })
    expect(engine.log).toContain('bus:a:create(pan=-1,vol=-3)')
  })

  test('subscribers are notified on update, acknowledge and tick', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels, staleAfterMs: 15_000 })
    let n = 0
    const unsubscribe = store.subscribe('a', () => n++)
    store.update('a', 0.035, 0)
    store.acknowledge('a')
    engine.tick(15_001)
    expect(n).toBe(3)
    unsubscribe()
    store.update('a', 0.034, 1000)
    expect(n).toBe(3)
  })

  test('getState for an unknown id returns a safe initial state; update is a no-op', () => {
    expect(store.getState('nope')).toMatchObject({ id: 'nope', level: null, intensity: 0 })
    expect(store.getState('nope')).toBe(store.getState('nope')) // stable identity for useSyncExternalStore
    expect(() => store.update('nope', 0.1, 0)).not.toThrow()
  })

  test('acknowledgeAll acknowledges every monitor in a level', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels })
    store.addMonitor({ id: 'b', direction: 'decreasing', levels })
    store.update('a', 0.035, 0)
    store.acknowledgeAll()
    expect(store.getState('a').acknowledged).toBe(true)
    expect(store.getState('b').acknowledged).toBe(false)
  })

  test('onEvent receives every event batch', () => {
    const seen: string[] = []
    store.addMonitor({ id: 'a', direction: 'decreasing', levels }, { onEvent: (events) => seen.push(...events.map((e) => e.type)) })
    store.update('a', 0.035, 0)
    expect(seen).toEqual(['enter', 'intensity'])
  })

  test('dispose cancels the tick loop', () => {
    expect(engine.log).toContain('repeat:1')
    store.dispose()
    expect(engine.log).toContain('repeat:cancel')
  })

  test('stop/start survive a StrictMode-style mount → unmount → mount', () => {
    store.addMonitor({ id: 'a', direction: 'decreasing', levels, staleAfterMs: 15_000 })
    store.update('a', 0.035, 0)
    store.start() // idempotent while running
    expect(engine.log.filter((l) => l === 'repeat:1')).toHaveLength(1)
    store.stop()
    engine.tick(15_001) // cancelled loop: nothing happens
    expect(store.getState('a').stale).toBe(false)
    store.start()
    engine.tick(15_002)
    expect(store.getState('a').stale).toBe(true)
  })

  test('default sounds (ADR-0001 §16) are used when the provider gives none', () => {
    const e2 = createMockEngine('ready')
    const s2 = createNotifierStore({ engine: e2 })
    s2.addMonitor({ id: 'a', direction: 'decreasing', levels })
    s2.update('a', 0.08, 0)
    expect(e2.continuous.has('a/sonar')).toBe(true)
    s2.update('a', 0.2, 1000)
    expect(e2.oneShots.get('a/allClear')!.plays).toBe(1)
  })
})
