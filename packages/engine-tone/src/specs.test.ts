import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SynthSpec } from '@earcon/core'
import type { InputNode } from 'tone'
import { FakeClock, FakeNode, fakeTone, resetFakeTone } from '../../../tests/utils/fake-tone'

mock.module('tone', () => fakeTone)

const { fromSpec } = await import('./fromSpec')
const dir = join(import.meta.dir, '..', 'specs')
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
const out = new FakeNode('Bus') as unknown as InputNode

/** Spec §4.4: SynthSpec twins of six presets live in specs/ and must build. */
describe('specs/*.json', () => {
  beforeEach(() => resetFakeTone())

  test('the six required twins exist', () => {
    expect(files.sort()).toEqual(['chime.json', 'coin.json', 'heartbeat.json', 'knock.json', 'parkingSensor.json', 'sonar.json'])
  })

  test.each(files)('%s parses as a SynthSpec and runs through fromSpec', (file) => {
    const spec = JSON.parse(readFileSync(join(dir, file), 'utf8')) as SynthSpec
    expect(spec.kind).toBe('synth')
    const sound = fromSpec(spec, { out })
    if (spec.mode === 'continuous') {
      const s = sound as { start(i: number): void; set(i: number): void; stop(): void }
      s.start(0)
      s.set(1)
      for (const c of FakeClock.instances) c.fire(0)
      s.stop()
    } else {
      ;(sound as { play(): void }).play()
    }
    expect(FakeNode.all.some((n) => n.calls.some((c) => c.method === 'triggerAttackRelease'))).toBe(true)
    sound.dispose()
    expect(FakeNode.live.size).toBe(0)
  })
})
