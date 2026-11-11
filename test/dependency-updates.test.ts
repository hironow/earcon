import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// This repository updates through ONE weekly pull request (a multi-ecosystem
// group, owner ruling 2026-09-14) instead of one pull request per ecosystem.
//
// The guard this replaces asserted the ordering of the `bun` ecosystem's own
// groups so that a generic development group could not claim `@types/react`
// before the `react-family` group claimed it (Dependabot uses the first matching
// group). With a single weekly group that hazard is gone by construction: every
// ecosystem — react, its renderer, their types, and everything else — lands in the
// same pull request, so nothing can pull a React bump apart from its counterparts.
// The assertions below keep that property from regressing.
test('Dependabot updates every ecosystem in one weekly group', () => {
  const config = Bun.YAML.parse(
    readFileSync(resolve(import.meta.dir, '../.github/dependabot.yaml'), 'utf8'),
  ) as {
    'multi-ecosystem-groups'?: Record<string, { schedule?: { interval?: string } }>
    updates?: Array<{
      'package-ecosystem': string
      'multi-ecosystem-group'?: string
      patterns?: string[]
      groups?: Record<string, unknown>
    }>
  }

  expect(config['multi-ecosystem-groups']?.weekly?.schedule?.interval).toBe('weekly')

  const updates = config.updates ?? []
  expect(updates.length).toBeGreaterThan(0)
  for (const update of updates) {
    expect(update['multi-ecosystem-group']).toBe('weekly')
    // A group of its own would make Dependabot open a second PR in the same week.
    expect(update.groups).toBeUndefined()
    expect(update.patterns).toEqual(['*'])
  }
  // React's family is no longer special-cased: `bun` rides in the same weekly PR
  // as the rest, which is exactly what the react-family group used to guarantee.
  expect(updates.map((update) => update['package-ecosystem'])).toContain('bun')
})
