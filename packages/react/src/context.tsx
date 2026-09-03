import { createContext, useContext } from 'react'
import type { Engine } from '@earcon/core'
import type { NotifierStore } from './store'

export interface NotifierContextValue {
  engine: Engine | null
  store: NotifierStore | null
}

export const NotifierContext = createContext<NotifierContextValue | null>(null)

export function useNotifierContext(): NotifierContextValue {
  const ctx = useContext(NotifierContext)
  if (!ctx) throw new Error('@earcon/react: wrap your tree in <NotifierProvider>')
  return ctx
}
