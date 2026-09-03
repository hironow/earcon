import { expect, test } from '@playwright/test'

/**
 * Spec §9: 50× start/stop across every continuous preset must not grow the audio
 * graph. Tone gives no node count, so we compare the JS heap after forced GC
 * between cycle 10 and cycle 50 and require the growth to stay small.
 */
test('50 start/stop cycles keep the heap stable after dispose', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('unlock').click()
  await expect(page.getByTestId('status')).toHaveAttribute('data-status', 'ready')

  const heaps = await page.evaluate(async () => {
    const { engine } = window.__earcon!
    const { continuous } = await window.__earcon!.presets()
    const gc = (window as unknown as { gc?: () => void }).gc
    const measure = async () => {
      gc?.()
      await new Promise((r) => setTimeout(r, 50))
      gc?.()
      return (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0
    }
    const bus = engine.createBus('leak')
    const cycle = async () => {
      for (const id of Object.keys(continuous)) {
        const s = engine.createContinuous({ kind: 'preset', id }, bus)
        s.start(0.5)
        s.set(0.9)
        await new Promise((r) => setTimeout(r, 5))
        s.stop()
        s.dispose()
      }
    }
    for (let i = 0; i < 10; i++) await cycle()
    const after10 = await measure()
    for (let i = 10; i < 50; i++) await cycle()
    const after50 = await measure()
    bus.dispose()
    return { after10, after50, hasGc: typeof gc === 'function' }
  })
  expect(heaps.hasGc).toBe(true)
  const growthMb = (heaps.after50 - heaps.after10) / 1024 / 1024
  expect(growthMb).toBeLessThan(4)
})
