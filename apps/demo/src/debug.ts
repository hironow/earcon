import type { ContinuousSound, Engine } from '@earcon/core'

/**
 * Dev-only handle for Playwright (tests/e2e). Never shipped: guarded by import.meta.env.DEV
 * and tree-shaken out of production builds.
 */
export interface EarconDebug {
  engine: Engine
  tone: () => Promise<typeof import('tone')>
  presets: () => Promise<typeof import('../../../packages/engine-tone/src/presets')>
  /** Ticks of a 1 Hz engine clock since unlock (spec §8 M5 background-tab check). */
  tickCount: () => number
  /** Continuous sounds currently started, by bus id (arbiter check). */
  activeContinuous: () => string[]
}

declare global {
  interface Window {
    __earcon?: EarconDebug
  }
}

export function exposeDebug(engine: Engine): void {
  if (!import.meta.env.DEV) return
  let ticks = 0
  engine.scheduleRepeat(() => {
    ticks++
  }, 1)

  // Wrap createContinuous so tests can see which sounds are started, straight from the engine layer.
  const started = new Map<ContinuousSound, string>()
  const original = engine.createContinuous.bind(engine)
  engine.createContinuous = (spec, bus) => {
    const sound = original(spec, bus)
    const wrapped: ContinuousSound = {
      start(i) {
        started.set(wrapped, bus.id)
        sound.start(i)
      },
      set: (i) => sound.set(i),
      stop() {
        started.delete(wrapped)
        sound.stop()
      },
      dispose() {
        started.delete(wrapped)
        sound.dispose()
      },
    }
    return wrapped
  }

  window.__earcon = {
    engine,
    tone: () => import('tone'),
    presets: () => import('../../../packages/engine-tone/src/presets'),
    tickCount: () => ticks,
    activeContinuous: () => [...new Set(started.values())].sort(),
  }
}
