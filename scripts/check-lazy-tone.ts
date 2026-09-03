#!/usr/bin/env bun
/**
 * Fails when the main entry of @earcon/engine-tone reaches `tone` through static
 * imports (spec §4.1: Tone.js must load inside unlock(), not in the initial bundle).
 * Walks `from "..."` and bare `import "..."` edges from dist/index.js.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const entry = resolve(import.meta.dir, '../packages/engine-tone/dist/index.js')
const seen = new Set<string>()
const queue = [entry]
const offenders: string[] = []

while (queue.length) {
  const file = queue.pop()!
  if (seen.has(file)) continue
  seen.add(file)
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/^import\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/gm)) {
    const spec = m[1]!
    if (spec === 'tone') offenders.push(file)
    else if (spec.startsWith('.')) queue.push(resolve(dirname(file), spec))
  }
}

if (offenders.length) {
  console.error('static import of "tone" reachable from engine-tone/dist/index.js via:\n  ' + offenders.join('\n  '))
  process.exit(1)
}
console.log(`ok: ${seen.size} chunk(s) reachable from engine-tone/dist/index.js, none import tone statically`)
