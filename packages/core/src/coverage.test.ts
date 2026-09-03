import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Every spec acceptance test id T1..T20 must be named by some core test (docs/spec-coverage.md). */
describe('spec coverage', () => {
  test('T1–T20 all appear in core test names', () => {
    const names = readdirSync(import.meta.dir)
      .filter((f) => f.endsWith('.test.ts'))
      .flatMap((f) => [...readFileSync(join(import.meta.dir, f), 'utf8').matchAll(/test\(\s*'([^']*)'/g)].map((m) => m[1]!))
    const ids = Array.from({ length: 20 }, (_, i) => `T${i + 1}`)
    const missing = ids.filter((id) => !names.some((n) => new RegExp(`\\b${id}\\b`).test(n)))
    expect(missing).toEqual([])
  })
})
