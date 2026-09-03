import { expect, test } from '@playwright/test'

/**
 * Spec §8 M5: with the tab hidden for 90 s the engine clock keeps ticking.
 * Two layers of "hidden": document.visibilityState is overridden (as the spec
 * asks) and a second page is brought to the front so Chromium really throttles
 * the first one. Runs in the `background` Playwright project only.
 */
test('hidden tab: the 1 Hz engine clock ticks ≈ 90 times in 90 s', async ({ page, context }) => {
  test.slow()
  await page.goto('/')
  await page.getByTestId('unlock').click()
  await expect(page.getByTestId('status')).toHaveAttribute('data-status', 'ready')
  await page.getByTestId('tab-wallets').click()
  await page.getByTestId('run-mixed').click()

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true })
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const front = await context.newPage()
  await front.goto('about:blank')
  await front.bringToFront()

  const t0 = await page.evaluate(() => window.__earcon!.tickCount())
  await front.waitForTimeout(90_000)
  const t1 = await page.evaluate(() => window.__earcon!.tickCount())
  const ticks = t1 - t0
  expect(ticks).toBeGreaterThanOrEqual(80)
  expect(ticks).toBeLessThanOrEqual(100)

  // the watchdog ran too: the `stale` wallets (w4, w8) went stale while hidden
  const stale = await page.evaluate(() => [...document.querySelectorAll('.wallet')].filter((w) => w.textContent?.includes('stale')).length)
  expect(stale).toBeGreaterThanOrEqual(1)
  await front.close()
})
