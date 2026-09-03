import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { InputNode } from 'tone'
import { FakeClock, FakeNode, fakeTone, resetFakeTone } from '../../../tests/utils/fake-tone'

mock.module('tone', () => fakeTone)

const { continuous, oneShot, catalog } = await import('./presets')
const { presetIds } = await import('./catalog')

const out = new FakeNode('Bus') as unknown as InputNode

describe('presets (spec appendix A) against a fake Tone', () => {
  beforeEach(() => resetFakeTone())

  test('the catalog lists exactly the registry ids', () => {
    expect([...presetIds.continuous].sort() as string[]).toEqual(Object.keys(continuous).sort())
    expect([...presetIds.oneShot].sort() as string[]).toEqual(Object.keys(oneShot).sort())
    expect(catalog).toHaveLength(28)
    expect(presetIds.continuous).toHaveLength(14)
    expect(presetIds.oneShot).toHaveLength(14)
  })

  test.each(Object.keys(continuous) as Array<keyof typeof continuous>)(
    'continuous %s: start/set/stop/dispose run and release every node',
    (id) => {
      const sound = continuous[id]({ out })
      const created = FakeNode.live.size
      expect(created).toBeGreaterThan(0)
      sound.start(0)
      sound.set(0.5)
      sound.set(1)
      for (const clock of FakeClock.instances) clock.fire(0)
      sound.stop()
      sound.dispose()
      expect(FakeNode.live.size).toBe(0)
    },
  )

  test.each(Object.keys(oneShot) as Array<keyof typeof oneShot>)(
    'oneShot %s: play with and without transpose, then dispose releases every node',
    (id) => {
      const sound = oneShot[id]({ out })
      sound.play()
      sound.play({ transpose: 7 })
      const triggered = FakeNode.all.some((n) => n.calls.some((c) => c.method === 'triggerAttackRelease' || c.method === 'triggerAttack'))
      expect(triggered).toBe(true)
      sound.dispose()
      expect(FakeNode.live.size).toBe(0)
    },
  )

  test('parkingSensor rate: 1/0.9 Hz at intensity 0, ≈ 11 Hz at intensity 1', () => {
    const sound = continuous.parkingSensor({ out })
    const clock = FakeClock.instances[0]!
    sound.start(0)
    expect(clock.frequency.value).toBeCloseTo(1 / 0.9, 6)
    sound.set(1)
    expect(clock.frequency.value).toBeCloseTo(1 / 0.09, 6)
    sound.dispose()
  })

  test('every preset has a hint and every continuous preset a rate', async () => {
    const { presetHint, presetRate } = await import('./catalog')
    expect(catalog.filter((p) => !presetHint[p.id]).map((p) => p.id)).toEqual([])
    expect(presetIds.continuous.filter((id) => !presetRate[id])).toEqual([])
  })

  test('rwrLock: duty ratio grows with intensity and overlaps at the top (continuous tone)', () => {
    const sound = continuous.rwrLock({ out })
    const clock = FakeClock.instances[0]!
    const synth = FakeNode.all.find((n) => n.kind === 'Synth')!
    sound.start(0)
    clock.fire(0)
    const low = synth.calls.at(-1)!.args[1] as number
    sound.set(1)
    clock.fire(1)
    const high = synth.calls.at(-1)!.args[1] as number
    expect(low).toBeCloseTo((1 / 3) * 0.2, 6)
    expect(high).toBeGreaterThan(1 / 30) // longer than the period → notes overlap
    sound.dispose()
  })

  test('spo2Pulse: pitch falls with intensity, tremolo depth only in the danger zone', () => {
    const sound = continuous.spo2Pulse({ out })
    const clock = FakeClock.instances[0]!
    const synth = FakeNode.all.find((n) => n.kind === 'Synth')!
    const tremolo = FakeNode.all.find((n) => n.kind === 'Tremolo')!
    sound.start(0)
    clock.fire(0)
    expect(synth.calls.at(-1)!.args[0]).toBe(880)
    expect(tremolo.depth.value).toBe(0)
    sound.set(0.5)
    expect(tremolo.depth.value).toBe(0)
    sound.set(1)
    clock.fire(1)
    expect(synth.calls.at(-1)!.args[0]).toBe(330)
    expect(tremolo.depth.value).toBeCloseTo(0.8, 6)
    expect(clock.frequency.value).toBeCloseTo(1.2, 6)
    sound.dispose()
  })

  test('kettle: sustained (no clock), frequency and gain follow intensity', () => {
    const sound = continuous.kettle({ out })
    expect(FakeClock.instances).toHaveLength(0)
    const osc = FakeNode.all.find((n) => n.kind === 'Oscillator')!
    sound.start(0)
    expect(osc.state).toBe('started')
    expect(osc.frequency.value).toBeCloseTo(2200, 6)
    sound.set(1)
    expect(osc.frequency.value).toBeCloseTo(3400, 6)
    sound.stop()
    expect(osc.state).toBe('stopped')
    sound.dispose()
    expect(FakeNode.live.size).toBe(0)
  })

  test('sosMorse: nine tones with strictly increasing start times', () => {
    const sound = oneShot.sosMorse({ out }) as { play(o: { time: number }): void; dispose(): void }
    sound.play({ time: 10 })
    const times = FakeNode.all.find((n) => n.kind === 'Synth')!.calls.filter((c) => c.method === 'triggerAttackRelease').map((c) => c.args[2] as number)
    expect(times).toHaveLength(9)
    for (let i = 1; i < times.length; i++) expect(times[i]!).toBeGreaterThan(times[i - 1]!)
    expect(times[0]).toBe(10)
    sound.dispose()
  })

  test('ticker drops ticks whose time is not after the previous tick (rate ramps)', () => {
    const sound = continuous.parkingSensor({ out })
    const clock = FakeClock.instances[0]!
    const synth = FakeNode.all.find((n) => n.kind === 'Synth')!
    sound.start(1)
    clock.fire(1.0)
    clock.fire(1.0) // duplicate
    clock.fire(0.9) // earlier
    clock.fire(1.1)
    expect(synth.calls.filter((c) => c.method === 'triggerAttackRelease').map((c) => c.args[2])).toEqual([1.0, 1.1])
    sound.dispose()
  })

  test('ticker does not restart an already started clock', () => {
    const sound = continuous.sonar({ out })
    const clock = FakeClock.instances[0]!
    sound.start(0)
    sound.start(0.2)
    expect(clock.calls.filter((c) => c.method === 'start')).toHaveLength(1)
    sound.stop()
    sound.stop()
    expect(clock.calls.filter((c) => c.method === 'stop')).toHaveLength(1)
    sound.dispose()
  })
})
