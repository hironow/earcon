import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { SynthSpec } from '@earcon/core'
import type { InputNode } from 'tone'
import { FakeClock, FakeNode, fakeTone, resetFakeTone } from '../../../tests/utils/fake-tone'

mock.module('tone', () => fakeTone)

const { fromSpec } = await import('./fromSpec')
const out = new FakeNode('Bus') as unknown as InputNode

const env = { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 }
const nodes = (kind: string) => FakeNode.all.filter((n) => n.kind === kind)
const calls = (kind: string, method: string) => nodes(kind).flatMap((n) => n.calls.filter((c) => c.method === method))

describe('fromSpec (spec §4.4)', () => {
  beforeEach(() => resetFakeTone())

  test('rejects an invalid spec at build time with every problem listed', () => {
    expect(() => fromSpec({ kind: 'synth' } as unknown as SynthSpec, { out })).toThrow(/mode[\s\S]*voice[\s\S]*envelope/)
    expect(() => fromSpec({ kind: 'synth', mode: 'continuous', voice: 'fm', envelope: env, volume: -6, pitch: { base: 'X9', semitonesAtMax: 0 } }, { out })).toThrow(/pitch\.base/)
    expect(FakeNode.live.size).toBe(0) // nothing was built
  })

  test.each([
    ['synth', 'Synth'],
    ['fm', 'FMSynth'],
    ['am', 'AMSynth'],
    ['membrane', 'MembraneSynth'],
    ['metal', 'MetalSynth'],
    ['noise', 'NoiseSynth'],
    ['pluck', 'PluckSynth'],
  ] as const)('voice %s creates a Tone.%s', (voice, cls) => {
    const sound = fromSpec({ kind: 'synth', mode: 'oneShot', voice, envelope: env, volume: -6, notes: [{ note: 'C5', at: 0, dur: 0.1 }] }, { out })
    expect(nodes(cls)).toHaveLength(1)
    expect(nodes(cls)[0]!.connections[0]).toBe(out as unknown as FakeNode)
    sound.dispose()
    expect(FakeNode.live.size).toBe(0)
  })

  test('oscillator type and volume are applied to the voice options', () => {
    fromSpec({ kind: 'synth', mode: 'oneShot', voice: 'synth', oscillator: 'square', envelope: env, volume: -9, notes: [{ note: 'C5', at: 0, dur: 0.1 }] }, { out })
    expect(nodes('Synth')[0]!.options).toEqual({ oscillator: { type: 'square' }, envelope: env, volume: -9 })
  })

  test('fx: filter and delay sit between the voice and the output, in that order', () => {
    const sound = fromSpec(
      {
        kind: 'synth',
        mode: 'oneShot',
        voice: 'synth',
        envelope: env,
        volume: -6,
        fx: { filter: { type: 'highpass', freq: 3000 }, delay: { time: 0.3, feedback: 0.4, wet: 0.3 } },
        notes: [{ note: 'C5', at: 0, dur: 0.1 }],
      },
      { out },
    )
    const synth = nodes('Synth')[0]!
    const filter = nodes('Filter')[0]!
    const delay = nodes('FeedbackDelay')[0]!
    expect(synth.connections[0]).toBe(filter)
    expect(filter.connections[0]).toBe(delay)
    expect(delay.connections[0]).toBe(out as unknown as FakeNode)
    expect(filter.options).toEqual({ frequency: 3000, type: 'highpass' })
    expect(delay.options).toEqual({ delayTime: 0.3, feedback: 0.4, wet: 0.3 })
    sound.dispose()
    expect(FakeNode.live.size).toBe(0)
  })

  describe('oneShot', () => {
    const spec: SynthSpec = {
      kind: 'synth',
      mode: 'oneShot',
      voice: 'synth',
      envelope: env,
      volume: -6,
      notes: [
        { note: 'C6', at: 0, dur: 0.07 },
        { note: 'G6', at: 0.08, dur: 0.25 },
      ],
    }

    test('play schedules every note at now + at, transposed', () => {
      const sound = fromSpec(spec, { out }) as { play(o?: { transpose?: number; velocity?: number; time?: number }): void }
      sound.play()
      const hits = calls('Synth', 'triggerAttackRelease')
      expect(hits).toHaveLength(2)
      expect(hits[0]!.args[1]).toBe(0.07)
      expect(hits[0]!.args[2]).toBeCloseTo(1.5, 6) // fakeTone.now()
      expect(hits[1]!.args[2]).toBeCloseTo(1.58, 6)
      const c6 = fakeTone.Frequency('C6').toFrequency()
      expect(hits[0]!.args[0]).toBeCloseTo(c6, 6)
      sound.play({ transpose: 12, time: 10 })
      const later = calls('Synth', 'triggerAttackRelease').slice(2)
      expect(later[0]!.args[0]).toBeCloseTo(c6 * 2, 6)
      expect(later[0]!.args[2]).toBe(10)
    })

    test('noise voice ignores notes and triggers duration only', () => {
      const sound = fromSpec({ ...spec, voice: 'noise' }, { out }) as { play(): void }
      sound.play()
      const hits = calls('NoiseSynth', 'triggerAttackRelease')
      expect(hits).toHaveLength(2)
      expect(hits[0]!.args[0]).toBe(0.07)
      expect(hits[0]!.args[1]).toBeCloseTo(1.5, 6)
    })

    test('velocity is passed through', () => {
      const sound = fromSpec(spec, { out }) as { play(o?: { velocity?: number }): void }
      sound.play({ velocity: 0.4 })
      expect(calls('Synth', 'triggerAttackRelease')[0]!.args[3]).toBe(0.4)
    })
  })

  describe('continuous', () => {
    const spec: SynthSpec = {
      kind: 'synth',
      mode: 'continuous',
      voice: 'synth',
      oscillator: 'square',
      envelope: env,
      volume: -10,
      rate: { minHz: 1 / 0.9, maxHz: 1 / 0.09 },
      pitch: { base: 'C6', semitonesAtMax: 0 },
    }

    test('drives a Tone.Clock through ticker(): linear rate at intensity 0 → 1', () => {
      const sound = fromSpec(spec, { out }) as { start(i: number): void; set(i: number): void; stop(): void; dispose(): void }
      const clock = FakeClock.instances[0]!
      sound.start(0)
      expect(clock.frequency.value).toBeCloseTo(1 / 0.9, 6)
      sound.set(0.5)
      expect(clock.frequency.value).toBeCloseTo((1 / 0.9 + 1 / 0.09) / 2, 6)
      sound.set(1)
      expect(clock.frequency.value).toBeCloseTo(1 / 0.09, 6)
      sound.stop()
      sound.dispose()
      expect(FakeNode.live.size).toBe(0)
    })

    test('rate.curve exp: minHz * (maxHz/minHz)^i', () => {
      const sound = fromSpec({ ...spec, rate: { minHz: 0.5, maxHz: 8, curve: 'exp' } }, { out }) as { start(i: number): void; set(i: number): void }
      const clock = FakeClock.instances[0]!
      sound.start(0.5)
      expect(clock.frequency.value).toBeCloseTo(0.5 * Math.sqrt(16), 6)
    })

    test('each tick plays pitch.base transposed by semitonesAtMax * intensity', () => {
      const sound = fromSpec({ ...spec, pitch: { base: 'A5', semitonesAtMax: 5 } }, { out }) as { start(i: number): void }
      sound.start(1)
      FakeClock.instances[0]!.fire(3)
      const hit = calls('Synth', 'triggerAttackRelease')[0]!
      expect(hit.args[0]).toBeCloseTo(fakeTone.Frequency('A5').transpose(5).toFrequency(), 6)
      expect(hit.args[2]).toBe(3)
    })

    test('pattern: multiple hits per tick at their offsets; offsets beyond the period are dropped', () => {
      const sound = fromSpec(
        {
          ...spec,
          voice: 'membrane',
          rate: { minHz: 1, maxHz: 1 },
          pattern: [
            { offset: 0, note: 'A1', dur: 0.12 },
            { offset: 0.16, note: 'G1', dur: 0.1 },
            { offset: 1.5, note: 'C1', dur: 0.1 },
          ],
        },
        { out },
      ) as { start(i: number): void }
      sound.start(0)
      FakeClock.instances[0]!.fire(2)
      const hits = calls('MembraneSynth', 'triggerAttackRelease')
      expect(hits).toHaveLength(2)
      expect(hits[0]!.args[2]).toBe(2)
      expect(hits[1]!.args[2]).toBeCloseTo(2.16, 6)
    })

    test('defaults: missing rate is 1 Hz flat; missing pitch is C5', () => {
      const sound = fromSpec({ kind: 'synth', mode: 'continuous', voice: 'synth', envelope: env, volume: -6 }, { out }) as { start(i: number): void }
      sound.start(1)
      expect(FakeClock.instances[0]!.frequency.value).toBe(1)
      FakeClock.instances[0]!.fire(0)
      expect(calls('Synth', 'triggerAttackRelease')[0]!.args[0]).toBeCloseTo(fakeTone.Frequency('C5').toFrequency(), 6)
    })
  })
})
