import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ContinuousSound, OneShotSound } from '@earcon/core'
import { FakeClock, FakeNode, fakeContext, fakeTone, fakeToneCalls, resetFakeTone } from '../../../tests/utils/fake-tone'
import { createToneEngine } from './engine'

type Presets = typeof import('./presets')

/** Recording preset factories: no Tone involved, so engine wiring is observable. */
function makePresets() {
  const log: string[] = []
  const cont = (id: string) => (): ContinuousSound => ({
    start: (i) => log.push(`${id}.start(${i})`),
    set: (i) => log.push(`${id}.set(${i})`),
    stop: () => log.push(`${id}.stop`),
    dispose: () => log.push(`${id}.dispose`),
  })
  const shot = (id: string) => (): OneShotSound => ({
    play: (o) => log.push(`${id}.play(${o?.transpose ?? 0})`),
    dispose: () => log.push(`${id}.dispose`),
  })
  const presets = {
    continuous: { sonar: cont('sonar'), parkingSensor: cont('parkingSensor') },
    oneShot: { knock: shot('knock'), allClear: shot('allClear') },
  } as unknown as Presets
  return { presets, log }
}

const AudioContextBackup = (globalThis as { AudioContext?: unknown }).AudioContext

const engines: ReturnType<typeof createToneEngine>[] = []

function engineWith(over: Parameters<typeof createToneEngine>[0] = {}) {
  const { presets, log } = makePresets()
  const engine = createToneEngine({
    loadTone: async () => fakeTone as unknown as typeof import('tone'),
    loadPresets: async () => presets,
    ...over,
  })
  engines.push(engine)
  return { engine, log }
}

describe('createToneEngine', () => {
  beforeEach(() => {
    resetFakeTone()
    ;(globalThis as { AudioContext?: unknown }).AudioContext = class {}
  })
  afterEach(() => {
    for (const e of engines.splice(0)) e.dispose()
    ;(globalThis as { AudioContext?: unknown }).AudioContext = AudioContextBackup
  })

  test('status is locked before unlock and unavailable without Web Audio', () => {
    expect(engineWith().engine.status).toBe('locked')
    delete (globalThis as { AudioContext?: unknown }).AudioContext
    expect(engineWith().engine.status).toBe('unavailable')
  })

  test('unlock loads tone lazily, calls Tone.start, sets lookAhead, becomes ready and notifies', async () => {
    const { engine } = engineWith({ lookAhead: 0.3 })
    const seen: string[] = []
    engine.onStatusChange((s) => seen.push(s))
    expect(fakeToneCalls.start).toBe(0)
    await engine.unlock()
    expect(fakeToneCalls.start).toBe(1)
    expect(fakeContext.lookAhead).toBe(0.3)
    expect(engine.status).toBe('ready')
    expect(seen).toEqual(['ready'])
    await engine.unlock() // idempotent
    expect(fakeToneCalls.start).toBe(1)
  })

  test('unlock ends in suspended when the context did not start running', async () => {
    const { engine } = engineWith({
      loadTone: async () => {
        fakeContext.state = 'suspended'
        return fakeTone as unknown as typeof import('tone')
      },
    })
    await engine.unlock()
    expect(engine.status).toBe('suspended')
  })

  test('sounds requested before unlock materialize afterwards; a started continuous sound resumes', async () => {
    const { engine, log } = engineWith()
    const bus = engine.createBus('w1', { pan: -0.5, volume: -3 })
    const sonar = engine.createContinuous({ kind: 'preset', id: 'sonar' }, bus)
    const parking = engine.createContinuous({ kind: 'preset', id: 'parkingSensor' }, bus)
    sonar.start(0.2)
    sonar.set(0.4)
    parking.start(0.9)
    parking.stop()
    expect(log).toEqual([])
    await engine.unlock()
    expect(log).toEqual(['sonar.start(0.4)'])
    sonar.set(0.7)
    expect(log.at(-1)).toBe('sonar.set(0.7)')
  })

  test('one-shots played before unlock are discarded (ADR-0001 §15)', async () => {
    const { engine, log } = engineWith()
    const bus = engine.createBus('w1')
    const knock = engine.createOneShot({ kind: 'preset', id: 'knock' }, bus)
    knock.play()
    knock.play({ transpose: 3 })
    await engine.unlock()
    expect(log).toEqual([])
    knock.play({ transpose: 3 })
    expect(log).toEqual(['knock.play(3)'])
  })

  test('sounds disposed before unlock are never built', async () => {
    const { engine, log } = engineWith()
    const bus = engine.createBus('w1')
    const sonar = engine.createContinuous({ kind: 'preset', id: 'sonar' }, bus)
    sonar.start(1)
    sonar.dispose()
    await engine.unlock()
    expect(log).toEqual([])
  })

  test('unknown preset id throws synchronously, even before unlock', () => {
    const { engine } = engineWith()
    const bus = engine.createBus('w1')
    expect(() => engine.createContinuous({ kind: 'preset', id: 'nope' }, bus)).toThrow(/nope/)
    expect(() => engine.createOneShot({ kind: 'preset', id: 'sonar' }, bus)).toThrow(/sonar/)
  })

  test('bus graph after unlock: Gain(volume) → Panner(pan) → mute → master → destination', async () => {
    const { engine } = engineWith({ masterVolumeDb: -6 })
    const bus = engine.createBus('w1', { pan: -0.5, volume: -3 })
    await engine.unlock()
    const gains = FakeNode.all.filter((n) => n.kind === 'Gain')
    const panner = FakeNode.all.find((n) => n.kind === 'Panner')!
    const busGain = gains.find((g) => g.connections.includes(panner))!
    expect(busGain.gain.value).toBe(-3)
    expect(busGain.options).toEqual({ gain: -3, units: 'decibels' })
    expect(panner.pan.value).toBe(-0.5)
    const mute = panner.connections[0]!
    const master = mute.connections[0]!
    expect(master.gain.value).toBe(-6)
    expect(master.connections[0]!.kind).toBe('Destination')
    bus.setPan(0.25)
    bus.setVolume(-12)
    expect(panner.pan.value).toBe(0.25)
    expect(busGain.gain.value).toBe(-12)
    engine.setMuted(true)
    expect(mute.gain.value).toBe(0)
    engine.setMuted(false)
    expect(mute.gain.value).toBe(1)
    engine.setMasterVolume(-20)
    expect(master.gain.value).toBe(-20)
  })

  test('mute and master volume set before unlock are applied at unlock', async () => {
    const { engine } = engineWith()
    engine.setMuted(true)
    engine.setMasterVolume(-30)
    await engine.unlock()
    const panner = FakeNode.all.find((n) => n.kind === 'Panner')
    expect(panner).toBeUndefined()
    const gains = FakeNode.all.filter((n) => n.kind === 'Gain')
    expect(gains.map((g) => g.gain.value).sort()).toEqual([-30, 0])
  })

  test('scheduleRepeat runs on a Tone.Clock after unlock and passes performance.now() milliseconds', async () => {
    const { engine } = engineWith()
    const ticks: number[] = []
    const cancel = engine.scheduleRepeat((now) => ticks.push(now), 2)
    await engine.unlock()
    const clock = FakeClock.instances[0]!
    expect(clock.frequency.value).toBe(0.5)
    expect(clock.state).toBe('started')
    const before = performance.now()
    clock.fire(123.456) // AudioContext seconds must not leak through
    expect(ticks).toHaveLength(1)
    expect(ticks[0]).toBeGreaterThanOrEqual(before)
    expect(ticks[0]).toBeLessThanOrEqual(performance.now())
    cancel()
    expect(clock.disposed).toBe(true)
  })

  test('scheduleRepeat cancelled before unlock never creates a clock', async () => {
    const { engine } = engineWith()
    const cancel = engine.scheduleRepeat(() => {}, 1)
    cancel()
    await engine.unlock()
    expect(FakeClock.instances).toHaveLength(0)
  })

  test('resume: running context → ready; failure → suspended', async () => {
    const { engine } = engineWith()
    await engine.unlock()
    fakeContext.rawContext.state = 'suspended'
    fakeContext.state = 'suspended'
    await engine.resume()
    expect(fakeContext.resumeCalls).toBe(1)
    expect(engine.status).toBe('ready')
    fakeContext.state = 'suspended'
    fakeContext.resumeFails = true
    await engine.resume()
    expect(engine.status).toBe('suspended')
  })

  test('visibilitychange to visible tries resume when the raw context is suspended', async () => {
    const { engine } = engineWith()
    await engine.unlock()
    fakeContext.rawContext.state = 'suspended'
    fakeContext.state = 'suspended'
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    await Promise.resolve()
    expect(fakeContext.resumeCalls).toBe(1)
    engine.dispose()
    fakeContext.rawContext.state = 'suspended'
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(fakeContext.resumeCalls).toBe(1)
  })

  test('dispose releases sounds, buses, clocks and the master chain', async () => {
    const { engine, log } = engineWith()
    const bus = engine.createBus('w1')
    engine.createContinuous({ kind: 'preset', id: 'sonar' }, bus)
    engine.scheduleRepeat(() => {}, 1)
    await engine.unlock()
    engine.dispose()
    expect(log).toContain('sonar.dispose')
    expect(FakeNode.live.size).toBe(0)
  })

  test('custom factory specs are called with the bus output', async () => {
    const { engine } = engineWith()
    const bus = engine.createBus('w1')
    let seenOut: unknown
    const sound = engine.createContinuous(
      { kind: 'custom', factory: ({ out }: { out: unknown }) => ((seenOut = out), { start() {}, set() {}, stop() {}, dispose() {} }) },
      bus,
    )
    await engine.unlock()
    expect(seenOut).toBeInstanceOf(FakeNode)
    sound.dispose()
  })
})
