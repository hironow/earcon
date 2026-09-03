import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * T20: `@earcon/core` never reads the clock or touches the host.
 * Mirrors .semgrep/rules/earcon-core-no-time.yaml so the guard also holds
 * where Semgrep is not installed. Test files are excluded (they may name
 * these identifiers, as this one does).
 */
const FORBIDDEN = [/\bDate\b/, /\bperformance\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\bwindow\b/, /\bglobalThis\b/]

const sourceFiles = readdirSync(import.meta.dir).filter(
  (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
)

describe('T20 core is time- and host-independent', () => {
  test('there are source files to scan', () => {
    expect(sourceFiles.length).toBeGreaterThanOrEqual(1)
  })

  test('no source file references Date, performance, timers, window or globalThis', () => {
    const offenders = sourceFiles.flatMap((f) => {
      const text = readFileSync(join(import.meta.dir, f), 'utf8')
      return FORBIDDEN.filter((re) => re.test(text)).map((re) => `${f}: ${re.source}`)
    })
    expect(offenders).toEqual([])
  })
})
