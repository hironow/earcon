#!/usr/bin/env bun
/**
 * Copies each workspace package's version from its package.json into bun.lock.
 * bun neither updates these entries on `bun install --lockfile-only` nor on
 * `bun pm version`, yet `bun pm pack` resolves `workspace:*` from them — so after
 * `changeset version` the lockfile must be synced or a package would depend on a
 * version that was never published (found 2026-09-04). Regenerating the lockfile is
 * not an option: it re-resolves every dependency.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const lockPath = resolve(root, 'bun.lock')
let lock = readFileSync(lockPath, 'utf8')
const workspaces = ['packages/core', 'packages/engine-tone', 'packages/react', 'apps/demo']
let changed = 0

for (const ws of workspaces) {
  const { name, version } = JSON.parse(readFileSync(resolve(root, ws, 'package.json'), 'utf8')) as { name: string; version: string }
  // Match the workspace block header `"<ws>": {` followed by its `"name"` and `"version"` lines.
  const re = new RegExp(`("${ws}": \\{\\s*"name": "${name.replace('/', '\\/')}",\\s*"version": ")([^"]*)(")`)
  const m = lock.match(re)
  if (!m) {
    console.error(`bun.lock: workspace block for ${ws} (${name}) not found`)
    process.exit(1)
  }
  if (m[2] !== version) {
    lock = lock.replace(re, `$1${version}$3`)
    console.log(`${name}: ${m[2]} → ${version}`)
    changed++
  }
}
writeFileSync(lockPath, lock)
console.log(changed ? `synced ${changed} workspace version(s) into bun.lock` : 'bun.lock workspace versions already in sync')
