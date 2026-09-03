/** True during server rendering. Split out so tests can mock it (bun `mock.module`). */
export function isServer(): boolean {
  return typeof window === 'undefined'
}

export function nowMs(): number {
  return performance.now()
}
