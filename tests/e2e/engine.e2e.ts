import { expect, test, type Page } from '@playwright/test'

/**
 * Spec §4.5 real-browser checks against apps/demo (Preset Auditioner).
 * The demo exposes `window.__earcon` in dev mode (apps/demo/src/debug.ts).
 */

async function unlock(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('status')).toHaveAttribute('data-status', 'locked')
  await page.getByTestId('unlock').click()
  await expect(page.getByTestId('status')).toHaveAttribute('data-status', 'ready')
}

test('(1) unlock → Tone.getContext().state === "running"', async ({ page }) => {
  await unlock(page)
  const state = await page.evaluate(async () => (await window.__earcon!.tone()).getContext().state)
  expect(state).toBe('running')
})

test('(2) every preset survives start/set/stop/dispose and play/dispose without throwing', async ({ page }) => {
  await unlock(page)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const result = await page.evaluate(async () => {
    const { engine } = window.__earcon!
    const Tone = await window.__earcon!.tone()
    const { continuous, oneShot } = await window.__earcon!.presets()
    const bus = engine.createBus('e2e', { pan: 0.2, volume: -3 })
    const failures: string[] = []
    for (const id of Object.keys(continuous)) {
      try {
        const s = engine.createContinuous({ kind: 'preset', id }, bus)
        s.start(0)
        s.set(0.5)
        s.set(1)
        await new Promise((r) => setTimeout(r, 120))
        s.stop()
        s.dispose()
      } catch (e) {
        failures.push(`${id}: ${(e as Error).message}`)
      }
    }
    for (const id of Object.keys(oneShot)) {
      try {
        const s = engine.createOneShot({ kind: 'preset', id }, bus)
        s.play()
        s.play({ transpose: 5, velocity: 0.5 })
        s.dispose()
      } catch (e) {
        failures.push(`${id}: ${(e as Error).message}`)
      }
    }
    bus.dispose()
    return { failures, contextState: Tone.getContext().state, count: Object.keys(continuous).length + Object.keys(oneShot).length }
  })
  expect(result.failures).toEqual([])
  expect(result.count).toBe(14)
  expect(result.contextState).toBe('running')
  expect(errors).toEqual([])
})

test('(3) parkingSensor: set(1) drives the Clock to ≈ 11 Hz', async ({ page }) => {
  await unlock(page)
  const hz = await page.evaluate(async () => {
    const Tone = await window.__earcon!.tone()
    const { parkingSensor } = await window.__earcon!.presets()
    // ticker() sounds carry their Clock (packages/engine-tone/src/ticker.ts)
    const sound = parkingSensor({ out: Tone.getDestination() }) as import('../../packages/engine-tone/src/ticker').TickerSound
    sound.start(0)
    const atZero = sound.clock.frequency.value
    sound.set(1)
    await new Promise((r) => setTimeout(r, 400)) // rampTo takes 0.2 s
    const atOne = sound.clock.frequency.value
    sound.stop()
    sound.dispose()
    return { atZero, atOne }
  })
  expect(hz.atZero).toBeCloseTo(1 / 0.9, 3)
  expect(hz.atOne).toBeGreaterThan(10.5)
  expect(hz.atOne).toBeLessThan(11.5)
})

test('UI: start/stop through the Auditioner row toggles the LED', async ({ page }) => {
  await unlock(page)
  const toggle = page.getByTestId('toggle-sonar')
  const led = page.getByTestId('row-sonar').locator('.led')
  await expect(led).toHaveAttribute('data-on', 'false')
  await toggle.click()
  await expect(led).toHaveAttribute('data-on', 'true')
  await toggle.click()
  await expect(led).toHaveAttribute('data-on', 'false')
  await page.getByTestId('play-coin').click()
})
