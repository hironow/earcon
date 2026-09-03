import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import type { Level, MonitorEvent } from '@earcon/core'
import { createMockEngine, type MockEngine } from '../../../tests/utils/mock-engine'
import { NotifierProvider, UnlockGate, useMonitor, useToneNotifier } from './index'

const levels: Level[] = [
  { id: 'watch', enter: 0.1, exit: 0.12 },
  { id: 'warn', enter: 0.05, exit: 0.06 },
  { id: 'critical', enter: 0.02, exit: 0.03 },
]

let engine: MockEngine
beforeEach(() => {
  engine = createMockEngine('locked')
})
afterEach(() => cleanup())

const handles = new Map<string, ReturnType<typeof useMonitor>>()

function Wallet({ id, onEvent }: { id: string; onEvent?: (e: MonitorEvent[]) => void }) {
  const renders = useRef(0)
  renders.current++
  const handle = useMonitor({ id, direction: 'decreasing', levels, ...(onEvent ? { onEvent } : {}) })
  handles.set(id, handle)
  return (
    <div data-testid={`wallet-${id}`} data-level={handle.state.level ?? 'safe'} data-renders={renders.current}>
      {handle.state.intensity.toFixed(2)}
    </div>
  )
}

function Sibling() {
  const renders = useRef(0)
  renders.current++
  return <div data-testid="sibling" data-renders={renders.current} />
}

describe('useMonitor', () => {
  test('creates a monitor and bus on mount, disposes on unmount', () => {
    const { unmount } = render(
      <NotifierProvider engine={engine}>
        <Wallet id="w1" />
      </NotifierProvider>,
    )
    expect(engine.log).toContain('bus:w1:create(pan=0,vol=0)')
    unmount()
    expect(engine.log).toContain('bus:w1:dispose')
  })

  test('update() drives the state through useSyncExternalStore without re-rendering siblings', () => {
    render(
      <NotifierProvider engine={engine}>
        <Wallet id="w1" />
        <Sibling />
      </NotifierProvider>,
    )
    const siblingRenders = screen.getByTestId('sibling').dataset.renders
    act(() => handles.get('w1')!.update(0.035, 1000))
    expect(screen.getByTestId('wallet-w1').dataset.level).toBe('warn')
    expect(screen.getByTestId('wallet-w1').textContent).toBe('0.50')
    expect(screen.getByTestId('sibling').dataset.renders).toBe(siblingRenders)
    expect(engine.continuous.get('w1/parkingSensor')!.started).toBe(true)
  })

  test('changing id disposes the old monitor and creates a new one', () => {
    const { rerender } = render(
      <NotifierProvider engine={engine}>
        <Wallet id="w1" />
      </NotifierProvider>,
    )
    act(() => handles.get('w1')!.update(0.035, 1000))
    rerender(
      <NotifierProvider engine={engine}>
        <Wallet id="w2" />
      </NotifierProvider>,
    )
    expect(engine.log).toContain('cont:w1/parkingSensor:dispose')
    expect(engine.log).toContain('bus:w1:dispose')
    expect(engine.log).toContain('bus:w2:create(pan=0,vol=0)')
    expect(screen.getByTestId('wallet-w2').dataset.level).toBe('safe')
  })

  test('acknowledge() stops the sound and is reflected in state', () => {
    render(
      <NotifierProvider engine={engine}>
        <Wallet id="w1" />
      </NotifierProvider>,
    )
    act(() => handles.get('w1')!.update(0.035, 1000))
    act(() => handles.get('w1')!.acknowledge())
    expect(handles.get('w1')!.state.acknowledged).toBe(true)
    expect(engine.continuous.get('w1/parkingSensor')!.started).toBe(false)
  })

  test('onEvent sees every batch and update() without t uses performance.now()', () => {
    const seen: MonitorEvent[] = []
    render(
      <NotifierProvider engine={engine}>
        <Wallet id="w1" onEvent={(e) => seen.push(...e)} />
      </NotifierProvider>,
    )
    act(() => handles.get('w1')!.update(0.035))
    expect(seen.map((e) => e.type)).toEqual(['enter', 'intensity'])
    expect(handles.get('w1')!.state.lastSample!.t).toBeGreaterThan(0)
  })

  test('throws outside a provider', () => {
    const orig = console.error
    console.error = () => {}
    expect(() => render(<Wallet id="x" />)).toThrow(/NotifierProvider/)
    console.error = orig
  })
})

function Controls() {
  const n = useToneNotifier()
  return (
    <div>
      <span data-testid="status">{n.status}</span>
      <span data-testid="muted">{String(n.muted)}</span>
      <button onClick={() => n.setMuted(!n.muted)}>mute</button>
      <button onClick={() => n.setMasterVolume(-12)}>vol</button>
      <button onClick={() => n.acknowledgeAll()}>ack</button>
    </div>
  )
}

describe('useToneNotifier and UnlockGate', () => {
  test('status follows the engine; mute, volume and acknowledgeAll reach the engine/store', () => {
    render(
      <NotifierProvider engine={engine}>
        <Controls />
        <Wallet id="w1" />
      </NotifierProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('locked')
    act(() => engine.setStatus('ready'))
    expect(screen.getByTestId('status').textContent).toBe('ready')
    fireEvent.click(screen.getByText('mute'))
    expect(screen.getByTestId('muted').textContent).toBe('true')
    expect(engine.log).toContain('muted:true')
    fireEvent.click(screen.getByText('vol'))
    expect(engine.log).toContain('master:-12')
    act(() => handles.get('w1')!.update(0.035, 1000))
    fireEvent.click(screen.getByText('ack'))
    expect(handles.get('w1')!.state.acknowledged).toBe(true)
  })

  test('UnlockGate.Default shows unlock while locked, resume while suspended, nothing when ready', async () => {
    render(
      <NotifierProvider engine={engine}>
        <UnlockGate.Default />
      </NotifierProvider>,
    )
    const unlock = document.querySelector('[data-earcon="unlock"]')!
    expect(unlock).not.toBeNull()
    await act(async () => {
      fireEvent.click(unlock)
    })
    expect(engine.log).toContain('unlock')
    expect(document.querySelector('[data-earcon]')).toBeNull()
    act(() => engine.setStatus('suspended'))
    expect(document.querySelector('[data-earcon="resume"]')).not.toBeNull()
    act(() => engine.setStatus('unavailable'))
    expect(document.querySelector('[data-earcon="unavailable"]')!.textContent).toMatch(/not available/)
  })

  test('UnlockGate passes status to its render prop', () => {
    render(
      <NotifierProvider engine={engine}>
        <UnlockGate>{({ status }) => <i data-testid="gate">{status}</i>}</UnlockGate>
      </NotifierProvider>,
    )
    expect(screen.getByTestId('gate').textContent).toBe('locked')
  })
})
