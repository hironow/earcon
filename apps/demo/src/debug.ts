import type { Engine } from '@earcon/core'

/**
 * Dev-only handle for Playwright (tests/e2e). Never shipped: guarded by import.meta.env.DEV
 * and tree-shaken out of production builds.
 */
export interface EarconDebug {
  engine: Engine
  tone: () => Promise<typeof import('tone')>
  presets: () => Promise<typeof import('../../../packages/engine-tone/src/presets')>
}

declare global {
  interface Window {
    __earcon?: EarconDebug
  }
}

export function exposeDebug(engine: Engine): void {
  if (!import.meta.env.DEV) return
  window.__earcon = {
    engine,
    tone: () => import('tone'),
    presets: () => import('../../../packages/engine-tone/src/presets'),
  }
}
