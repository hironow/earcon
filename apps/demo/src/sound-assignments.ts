import { useSyncExternalStore } from 'react'
import type { SoundSpec } from '@earcon/core'

/**
 * Demo-wide "which sound plays for which level" (spec §8 M4: a Designer sound can
 * be assigned to a Simulator level). Tiny external store; not part of the library.
 */
export type Assignments = Record<string, SoundSpec>

let assignments: Assignments = {}
/** Bumps on every change, so a monitor id that embeds it is rebuilt even when the same level gets a new spec. */
let revision = 0
const listeners = new Set<() => void>()

export function assignSound(level: string, spec: SoundSpec | null) {
  const next = { ...assignments }
  if (spec) next[level] = spec
  else delete next[level]
  assignments = next
  revision++
  for (const cb of listeners) cb()
}

export function useAssignmentRevision(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => revision,
    () => revision,
  )
}

export function useAssignments(): Assignments {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => assignments,
    () => assignments,
  )
}
