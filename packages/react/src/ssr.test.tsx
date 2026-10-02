import { describe, expect, mock, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { createMockEngine } from '../../../tests/utils/mock-engine'

// `mock.module` overwrites a module's exports for the WHOLE test process — every
// file shares one — and `mock.restore()` does not put them back (bun 1.4.x). So the
// server mock below lives strictly inside this one test: applied just before the
// render, undone in `finally`. Left installed past this file, it decides whether the
// suite passes by scheduling luck — a file that ran later would take the server
// branch (`store === null` in NotifierProvider), and useSyncExternalStore would loop
// until React threw "Maximum update depth exceeded". Capture the real exports as
// function values: the namespace object itself is what the mock overwrites.
const { isServer: realIsServer, nowMs: realNowMs } = await import('./env')

const { NotifierProvider, UnlockGate, useMonitor, useToneNotifier } = await import('./index')

function Probe() {
  const n = useToneNotifier()
  const m = useMonitor({ id: 'w', direction: 'decreasing', levels: [{ id: 'watch', enter: 0.1, exit: 0.12 }] })
  return (
    <p>
      {n.status}/{m.state.level ?? 'safe'}
    </p>
  )
}

describe('server rendering (spec §5.2)', () => {
  test('renders with status locked and never touches the engine', () => {
    const engine = createMockEngine('ready')
    mock.module('./env', () => ({ isServer: () => true, nowMs: () => 0 }))
    try {
      const html = renderToString(
        <NotifierProvider engine={engine}>
          <UnlockGate.Default />
          <Probe />
        </NotifierProvider>,
      )
      expect(html.replace(/<!-- -->/g, '')).toContain('locked/safe')
      expect(html).toContain('data-earcon="unlock"')
      expect(engine.log).toEqual([])
    } finally {
      mock.module('./env', () => ({ isServer: realIsServer, nowMs: realNowMs }))
    }
  })
})
