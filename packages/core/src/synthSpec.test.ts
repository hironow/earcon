import { describe, expect, test } from 'bun:test'
import { isSynthSpec, validateSynthSpec } from './synthSpec'

const good = {
  kind: 'synth',
  mode: 'continuous',
  voice: 'synth',
  oscillator: 'square',
  envelope: { attack: 0.002, decay: 0.05, sustain: 0.3, release: 0.03 },
  volume: -10,
  rate: { minHz: 1, maxHz: 8, curve: 'linear' },
  pitch: { base: 'C6', semitonesAtMax: 0 },
  pattern: [{ offset: 0, dur: 0.05 }],
}

describe('validateSynthSpec', () => {
  test('a complete spec has no errors and passes isSynthSpec', () => {
    expect(validateSynthSpec(good)).toEqual([])
    expect(isSynthSpec(good)).toBe(true)
  })

  test.each([
    [null, /object/],
    ['synth', /object/],
    [{ kind: 'preset' }, /kind/],
    [{ kind: 'synth' }, /mode/],
    [{ kind: 'synth', mode: 'continuous' }, /voice/],
    [{ kind: 'synth', mode: 'continuous', voice: 'synth' }, /envelope/],
    [{ ...good, envelope: { attack: -1, decay: 0.1, sustain: 0.5, release: 0.1 } }, /envelope\.attack/],
    [{ ...good, envelope: { attack: 0.01, decay: 0.1, sustain: 2, release: 0.1 } }, /envelope\.sustain/],
    [{ ...good, volume: 'loud' }, /volume/],
    [{ ...good, voice: 'theremin' }, /voice/],
    [{ ...good, oscillator: 'noise' }, /oscillator/],
    [{ ...good, rate: { minHz: 0, maxHz: 8 } }, /rate\.minHz/],
    [{ ...good, rate: { minHz: 1, maxHz: 8, curve: 'cubic' } }, /rate\.curve/],
    [{ ...good, pitch: { base: 'X9', semitonesAtMax: 0 } }, /pitch\.base/],
    [{ ...good, pitch: { base: '', semitonesAtMax: 0 } }, /pitch\.base/],
    [{ ...good, pattern: [{ offset: -1, dur: 0.1 }] }, /pattern\[0\]\.offset/],
    [{ ...good, pattern: [{ offset: 0, note: 'ドレミ', dur: 0.1 }] }, /pattern\[0\]\.note/],
    [{ ...good, mode: 'oneShot', notes: [{ note: 'C5', at: 0, dur: 0 }] }, /notes\[0\]\.dur/],
    [{ ...good, mode: 'oneShot', notes: 'C5' }, /notes/],
    [{ ...good, fx: { delay: { time: 0.3, feedback: 1.5, wet: 0.3 } } }, /fx\.delay\.feedback/],
    [{ ...good, fx: { filter: { type: 'bandpass', freq: 100 } } }, /fx\.filter\.type/],
  ] as const)('%j → error matching %s', (spec, re) => {
    const errors = validateSynthSpec(spec)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => re.test(e))).toBe(true)
    expect(isSynthSpec(spec)).toBe(false)
  })

  test('accepts sharps, flats and negative octaves in note names', () => {
    expect(validateSynthSpec({ ...good, pitch: { base: 'Bb-1', semitonesAtMax: 3 } })).toEqual([])
    expect(validateSynthSpec({ ...good, pitch: { base: 'F#4', semitonesAtMax: 3 } })).toEqual([])
  })

  test('every problem is reported, not just the first', () => {
    const errors = validateSynthSpec({ kind: 'synth', mode: 'nope', voice: 'nope', envelope: {}, volume: null })
    expect(errors.length).toBeGreaterThanOrEqual(4)
  })
})
