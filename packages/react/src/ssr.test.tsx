import { describe, expect, mock, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { createMockEngine } from '../../../tests/utils/mock-engine'

mock.module('./env', () => ({ isServer: () => true, nowMs: () => 0 }))

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
    const html = renderToString(
      <NotifierProvider engine={engine}>
        <UnlockGate.Default />
        <Probe />
      </NotifierProvider>,
    )
    expect(html.replace(/<!-- -->/g, '')).toContain('locked/safe')
    expect(html).toContain('data-earcon="unlock"')
    expect(engine.log).toEqual([])
  })
})
