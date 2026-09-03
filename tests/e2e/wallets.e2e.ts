import { expect, test } from '@playwright/test'

/** Spec §8 M5: with eight monitors, worst-only makes exactly one sound; all makes every dangerous one sound. */
test('wallets: worst-only → one active continuous sound; all → one per dangerous wallet; top-n → n', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('unlock').click()
  await expect(page.getByTestId('status')).toHaveAttribute('data-status', 'ready')
  await page.getByTestId('tab-wallets').click()
  await page.getByTestId('policy-worst').click()
  await page.getByTestId('run-crash').click()
  // crash: 10 s at 0.15 (safe) then 3 s down to 0.01 (critical). While the drop
  // is in flight the wallets differ by a few ms and the arbiter legitimately
  // follows whichever is ahead; once every wallet sits at 0.010 they tie and the
  // id order decides. So wait for the end of the scenario before freezing.
  await expect(page.getByTestId('wallet-w8')).toHaveAttribute('data-level', 'critical', { timeout: 16_000 })
  await page.waitForTimeout(2_000)
  await page.getByTestId('run-stop').click() // freeze values (monitors keep their level)
  await page.waitForTimeout(300)

  const active = async () => page.evaluate(() => window.__earcon!.activeContinuous())
  expect(await active()).toEqual(['w1']) // same level & intensity → id ascending
  await expect(page.getByTestId('wallet-w1')).toHaveAttribute('data-audible', 'true')
  await expect(page.getByTestId('wallet-w2')).toHaveAttribute('data-audible', 'false')

  await page.getByTestId('policy-all').click()
  await page.waitForTimeout(200)
  expect(await active()).toEqual(['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'])

  await page.getByTestId('policy-top').click()
  await page.waitForTimeout(200)
  expect(await active()).toEqual(['w1', 'w2'])

  // acknowledging the worst hands the slot to the next id
  await page.getByTestId('policy-worst').click()
  await page.getByTestId('ack-w1').click()
  await page.waitForTimeout(200)
  expect(await active()).toEqual(['w2'])
})
