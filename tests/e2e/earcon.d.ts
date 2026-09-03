import type { EarconDebug } from '../../apps/demo/src/debug'

declare global {
  interface Window {
    /** Dev-only handle installed by apps/demo/src/debug.ts */
    __earcon?: EarconDebug
  }
}

export {}
