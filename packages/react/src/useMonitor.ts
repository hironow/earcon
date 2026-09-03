import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import type { MonitorEvent, MonitorOptions, MonitorState, SoundSpec } from '@earcon/core'
import { useNotifierContext } from './context'
import { nowMs } from './env'
import { initialMonitorState } from './store'

export interface UseMonitorOptions extends MonitorOptions {
  /** Overrides the provider's `sounds` for this monitor. */
  sounds?: Partial<Record<string, SoundSpec>>
  /** -1..1 */
  pan?: number
  /** dB */
  volume?: number
  /** Every event batch, e.g. for a log. Not part of React state. */
  onEvent?: (events: MonitorEvent[], state: MonitorState) => void
}

export interface MonitorHandle {
  state: MonitorState
  /** Synchronous. `t` defaults to `performance.now()`; must be monotonic. */
  update(value: number, t?: number): void
  acknowledge(): void
}

/**
 * One monitored value (spec §5.2). The monitor is (re)created only when `id`
 * changes; other option changes are ignored until the id changes.
 */
export function useMonitor(opts: UseMonitorOptions): MonitorHandle {
  const { store } = useNotifierContext()
  const id = opts.id
  const latest = useRef(opts)
  latest.current = opts

  useEffect(() => {
    if (!store) return
    const { sounds, pan, volume, onEvent: _ignored, ...monitorOpts } = latest.current
    const extras: Parameters<typeof store.addMonitor>[1] = {
      onEvent: (events, state) => latest.current.onEvent?.(events, state),
    }
    if (sounds !== undefined) extras.sounds = sounds
    if (pan !== undefined) extras.pan = pan
    if (volume !== undefined) extras.volume = volume
    store.addMonitor({ ...monitorOpts, id }, extras)
    return () => store.removeMonitor(id)
  }, [store, id])

  const subscribe = useCallback((cb: () => void) => (store ? store.subscribe(id, cb) : () => {}), [store, id])
  const getSnapshot = useCallback(() => (store ? store.getState(id) : initialMonitorState(id)), [store, id])
  const getServerSnapshot = useCallback(() => initialMonitorState(id), [id])
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const update = useCallback((value: number, t: number = nowMs()) => store?.update(id, value, t), [store, id])
  const acknowledge = useCallback(() => store?.acknowledge(id), [store, id])

  return { state, update, acknowledge }
}
