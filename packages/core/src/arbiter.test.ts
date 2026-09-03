import { describe, expect, test } from 'bun:test'
import { selectAudible } from './arbiter'
import type { MonitorState } from './types'

const LEVELS = ['watch', 'warn', 'critical']
const levelIndexOf = (s: MonitorState) => (s.level === null ? -1 : LEVELS.indexOf(s.level))

const state = (id: string, level: string | null, intensity: number, extra: Partial<MonitorState> = {}): MonitorState => ({
  id,
  level,
  stale: false,
  intensity,
  eta: null,
  velocity: 0,
  acknowledged: false,
  lastSample: null,
  ...extra,
})

describe('selectAudible', () => {
  test('T18 worst-only: warn(.9), critical(.2), critical(acked) → [critical(.2)]', () => {
    const states = [
      state('a', 'warn', 0.9),
      state('b', 'critical', 0.2),
      state('c', 'critical', 0.95, { acknowledged: true }),
    ]
    expect(selectAudible(states, levelIndexOf, { mode: 'worst-only' })).toEqual(['b'])
  })

  test('T19 determinism: same level and intensity → id ascending', () => {
    const states = [state('zeta', 'warn', 0.5), state('alpha', 'warn', 0.5), state('mid', 'warn', 0.5)]
    expect(selectAudible(states, levelIndexOf, { mode: 'all' })).toEqual(['alpha', 'mid', 'zeta'])
    expect(selectAudible(states, levelIndexOf, { mode: 'worst-only' })).toEqual(['alpha'])
  })

  test('excludes safe, acknowledged and stale monitors', () => {
    const states = [
      state('safe', null, 0),
      state('acked', 'critical', 1, { acknowledged: true }),
      state('stale', 'critical', 1, { stale: true }),
      state('live', 'watch', 0.1),
    ]
    expect(selectAudible(states, levelIndexOf, { mode: 'all' })).toEqual(['live'])
  })

  test('ranks by level index desc, then intensity desc, then id asc', () => {
    const states = [
      state('w-lo', 'warn', 0.1),
      state('c-lo', 'critical', 0.1),
      state('w-hi', 'warn', 0.8),
      state('c-hi', 'critical', 0.8),
    ]
    expect(selectAudible(states, levelIndexOf, { mode: 'all' })).toEqual(['c-hi', 'c-lo', 'w-hi', 'w-lo'])
  })

  test('top-n returns the first n of the ranking', () => {
    const states = [state('a', 'watch', 0.1), state('b', 'critical', 0.1), state('c', 'warn', 0.5)]
    expect(selectAudible(states, levelIndexOf, { mode: 'top-n', n: 2 })).toEqual(['b', 'c'])
    expect(selectAudible(states, levelIndexOf, { mode: 'top-n', n: 0 })).toEqual([])
  })

  test('does not mutate the input', () => {
    const states = [state('b', 'warn', 0.5), state('a', 'warn', 0.5)]
    selectAudible(states, levelIndexOf, { mode: 'all' })
    expect(states.map((s) => s.id)).toEqual(['b', 'a'])
  })
})
