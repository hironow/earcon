import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('Dependabot updates React, its renderer and their types together', () => {
  const config = Bun.YAML.parse(
    readFileSync(resolve(import.meta.dir, '../.github/dependabot.yaml'), 'utf8'),
  ) as {
    updates: Array<{
      'package-ecosystem': string
      groups: Record<string, { patterns?: string[]; 'dependency-type'?: string }>
    }>
  }
  const groups = config.updates.find((update) => update['package-ecosystem'] === 'bun')!.groups
  // Dependabot uses the first matching group. A generic development group must
  // not claim @types/react before the runtime family can claim it.
  expect(Object.keys(groups)[0]).toBe('react-family')
  expect(groups['react-family'].patterns?.toSorted()).toEqual(
    ['react', 'react-dom', '@types/react', '@types/react-dom'].toSorted(),
  )
  expect(groups['react-family']['dependency-type']).toBeUndefined()
})
