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
    expect(catalog).toHaveLength(14)
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
      const triggered = FakeNode.all.some((n) => n.calls.some((c) => c.method === 'triggerAttackRelease'))
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
