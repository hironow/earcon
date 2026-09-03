import { useEffect, useMemo, type ReactNode } from 'react'
import type { ArbiterPolicy, Engine, SoundSpec } from '@earcon/core'
import { NotifierContext } from './context'
import { isServer } from './env'
import { createNotifierStore, type TransitionSounds } from './store'

export interface NotifierProviderProps {
  /** The audio engine, e.g. `createToneEngine()`. Create it once, outside render. */
  engine: Engine
  /** Level id → continuous sound. Default: `watch` sonar, `warn` parkingSensor, `critical` hiLoSiren. */
  sounds?: Record<string, SoundSpec>
  /** Default: `toSafe` allClear, `stale` knock, no `escalate`. */
  transitions?: TransitionSounds
  /** Default `{ mode: 'worst-only' }`. */
  policy?: ArbiterPolicy
  /** Watchdog tick period. Default 1. Changing it requires a remount. */
  tickIntervalSec?: number
  /** Repeat period of the stale sound. Default 10. */
  staleRepeatSec?: number
  children?: ReactNode
}

/**
 * Owns the monitors, buses and sounds for the tree below it and wires monitor
 * events to the engine (spec §5.1 / §5.4). On the server it renders children
 * without touching the engine.
 */
export function NotifierProvider({
  engine,
  sounds,
  transitions,
  policy,
  tickIntervalSec,
  staleRepeatSec,
  children,
}: NotifierProviderProps) {
  const server = isServer()
  const store = useMemo(() => {
    if (server) return null
    const config: Parameters<typeof createNotifierStore>[0] = { engine }
    if (tickIntervalSec !== undefined) config.tickIntervalSec = tickIntervalSec
    return createNotifierStore(config)
  }, [engine, server, tickIntervalSec])

  useEffect(() => {
    if (!store) return
    const patch: Parameters<typeof store.configure>[0] = {}
    if (sounds !== undefined) patch.sounds = sounds
    if (transitions !== undefined) patch.transitions = transitions
    if (policy !== undefined) patch.policy = policy
    if (staleRepeatSec !== undefined) patch.staleRepeatSec = staleRepeatSec
    store.configure(patch)
  }, [store, sounds, transitions, policy, staleRepeatSec])

  useEffect(() => () => store?.dispose(), [store])

  const value = useMemo(() => ({ engine: server ? null : engine, store }), [engine, server, store])
  return <NotifierContext.Provider value={value}>{children}</NotifierContext.Provider>
}
