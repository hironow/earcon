#!/usr/bin/env bun
/**
 * Packs every publishable package with `bun pm pack` (which resolves workspace:
 * and catalog: protocols) into dist-pack/ and fails if a packed package.json still
 * contains either protocol, or if a tarball carries anything outside the allowed
 * top-level entries. The npm CLI does not rewrite these protocols (ADR-0008), so
 * only these tarballs may be handed to `npm publish`.
 */
import { $ } from 'bun'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const out = join(root, 'dist-pack')
const packages = ['core', 'engine-tone', 'react']
const allowedTop = new Set(['package.json', 'README.md', 'LICENSE', 'dist', 'specs'])

rmSync(out, { recursive: true, force: true })
mkdirSync(out)

let failed = false
for (const pkg of packages) {
  const dir = join(root, 'packages', pkg)
  if (!existsSync(join(dir, 'dist', 'index.js'))) {
    console.error(`${pkg}: dist/ missing — run just build first`)
    failed = true
    continue
  }
  await $`bun pm pack --destination ${out} --quiet`.cwd(dir)
  const tgz = readdirSync(out).find((f) => f.startsWith(`earcon-${pkg}-`) && f.endsWith('.tgz'))
  if (!tgz) {
    console.error(`${pkg}: no tarball produced`)
    failed = true
    continue
  }
  const manifest = await $`tar -xOzf ${join(out, tgz)} package/package.json`.text()
  const bad = manifest.match(/"(workspace|catalog):[^"]*"/g)
  if (bad) {
    console.error(`${pkg}: unresolved protocol in packed package.json: ${bad.join(', ')}`)
    failed = true
  }
  const entries = (await $`tar -tzf ${join(out, tgz)}`.text()).trim().split('\n')
  const top = new Set(entries.map((e) => e.replace(/^package\//, '').split('/')[0]!))
  const extra = [...top].filter((t) => !allowedTop.has(t))
  if (extra.length) {
    console.error(`${pkg}: unexpected top-level entries in tarball: ${extra.join(', ')}`)
    failed = true
  }
  console.log(`ok: ${tgz} (${entries.length} files, protocols resolved)`)
}
if (failed) process.exit(1)
