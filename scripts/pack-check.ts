#!/usr/bin/env bun
/**
 * Packs every publishable package with `bun pm pack` (which resolves workspace:
 * and catalog: protocols) into dist-pack/ and fails if a packed package.json still
 * contains either protocol, or if a tarball carries anything outside the allowed
 * top-level entries. The npm CLI does not rewrite these protocols (ADR-0008), so
 * only these tarballs may be handed to `npm publish`.
 */
import { $ } from 'bun'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const out = join(root, 'dist-pack')
const packages = ['core', 'engine-tone', 'react']
const allowedTop = new Set(['package.json', 'README.md', 'LICENSE', 'dist', 'specs'])

rmSync(out, { recursive: true, force: true })
mkdirSync(out)

let failed = false
const failedPkgs = new Set<string>()
const failedBefore = (f: boolean, pkg: string) => {
  if (f && !failedPkgs.has(pkg) && failedPkgs.size === 0) failedPkgs.add(pkg)
  return failedPkgs.has(pkg)
}
for (const pkg of packages) {
  failedPkgs.clear()
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
  // Internal dependencies must point at the versions that ship in this same release
  // (bun resolves workspace:* from bun.lock, which can lag behind package.json).
  const deps = (JSON.parse(manifest) as { dependencies?: Record<string, string> }).dependencies ?? {}
  for (const [dep, range] of Object.entries(deps)) {
    if (!dep.startsWith('@earcon/')) continue
    const depVersion = JSON.parse(readFileSync(join(root, 'packages', dep.slice('@earcon/'.length), 'package.json'), 'utf8')).version as string
    if (range !== depVersion) {
      console.error(`${pkg}: depends on ${dep}@${range} but the workspace is ${depVersion} — run just release-version (syncs bun.lock)`)
      failed = true
    }
  }
  const entries = (await $`tar -tzf ${join(out, tgz)}`.text()).trim().split('\n')
  const top = new Set(entries.map((e) => e.replace(/^package\//, '').split('/')[0]!))
  const extra = [...top].filter((t) => !allowedTop.has(t))
  if (extra.length) {
    console.error(`${pkg}: unexpected top-level entries in tarball: ${extra.join(', ')}`)
    failed = true
  }
  if (!failedBefore(failed, pkg)) console.log(`ok: ${tgz} (${entries.length} files, protocols and internal versions resolved)`)
}
if (failed) process.exit(1)
