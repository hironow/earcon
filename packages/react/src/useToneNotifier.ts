import { useCallback, useState, useSyncExternalStore } from 'react'
import type { EngineStatus } from '@earcon/core'
import { useNotifierContext } from './context'

export interface ToneNotifier {
  status: EngineStatus
  /** Call from a user-gesture handler (click, keydown). */
  unlock(): Promise<void>
  resume(): Promise<void>
  muted: boolean
  setMuted(muted: boolean): void
  setMasterVolume(db: number): void
  acknowledgeAll(): void
}

const noop = () => () => {}

/** Engine status and global controls (spec §5.2). `status` is `'locked'` on the server. */
export function useToneNotifier(): ToneNotifier {
  const { engine, store } = useNotifierContext()
  const status = useSyncExternalStore<EngineStatus>(
    engine ? engine.onStatusChange : noop,
    () => engine?.status ?? 'locked',
    () => 'locked',
  )
  const [muted, setMutedState] = useState(false)

  const unlock = useCallback(() => engine?.unlock() ?? Promise.resolve(), [engine])
  const resume = useCallback(() => engine?.resume() ?? Promise.resolve(), [engine])
  const setMuted = useCallback(
    (m: boolean) => {
      setMutedState(m)
      engine?.setMuted(m)
    },
    [engine],
  )
  const setMasterVolume = useCallback((db: number) => engine?.setMasterVolume(db), [engine])
  const acknowledgeAll = useCallback(() => store?.acknowledgeAll(), [store])

  return { status, unlock, resume, muted, setMuted, setMasterVolume, acknowledgeAll }
}
