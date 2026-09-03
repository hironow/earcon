import type { SynthSpec } from '@earcon/core'

/** Named SynthSpecs in localStorage (spec §7.4: the demo owns persistence, not the library). */
const KEY = 'earcon.designer.v1'

export interface SavedSpec {
  name: string
  spec: SynthSpec
  savedAt: number
}

export function listSaved(): SavedSpec[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SavedSpec[]) : []
  } catch {
    return []
  }
}

export function saveSpec(name: string, spec: SynthSpec): SavedSpec[] {
  const next = [...listSaved().filter((s) => s.name !== name), { name, spec, savedAt: Date.now() }].sort((a, b) => a.name.localeCompare(b.name))
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function deleteSpec(name: string): SavedSpec[] {
  const next = listSaved().filter((s) => s.name !== name)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function downloadSpec(name: string, spec: SynthSpec) {
  const blob = new Blob([JSON.stringify(spec, null, 2) + '\n'], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name || 'sound'}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
