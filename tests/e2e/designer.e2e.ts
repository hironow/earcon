import { expect, test } from '@playwright/test'

/** Spec §8 M4: a Designer sound can be assigned to a Simulator level and plays there. */
test('designer: twins preview, JSON round-trip, save, assign to warn, simulator uses it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByTestId('unlock').click()
  await expect(page.getByTestId('status')).toHaveAttribute('data-status', 'ready')
  await page.getByTestId('tab-designer').click()

  // continuous twin: preview start/stop
  await page.getByTestId('twin-parkingSensor').click()
  await page.getByTestId('dz-toggle').click()
  await expect(page.getByTestId('dz-toggle')).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(300)
  await page.getByTestId('dz-toggle').click()

  // oneShot twin: play
  await page.getByTestId('twin-coin').click()
  await page.getByTestId('dz-play').click()

  // JSON panel round-trip: edit volume in the text and load it back
  await page.getByTestId('twin-parkingSensor').click()
  const json = await page.getByTestId('dz-json').inputValue()
  const edited = json.replace('"volume": -10', '"volume": -12')
  await page.getByTestId('dz-json').fill(edited)
  await page.getByRole('button', { name: '読み込む' }).click()
  await expect(page.getByTestId('dz-json')).toHaveValue(/"volume": -12/)

  // save to localStorage
  await page.getByTestId('dz-name').fill('quiet-parking')
  await page.getByTestId('dz-save').click()
  await expect(page.getByTestId('dz-saved')).toContainText('quiet-parking')
  const stored = await page.evaluate(() => localStorage.getItem('earcon.designer.v1'))
  expect(stored).toContain('quiet-parking')

  // assign to warn, then drive the simulator into warn
  await page.getByTestId('assign-warn').click()
  await page.getByTestId('tab-simulator').click()
  await expect(page.getByText(/Designer の音: warn/)).toBeVisible()
  await page.getByTestId('sim-value').fill('0.035')
  await expect(page.getByTestId('sim-level')).toHaveText('warn')
  await expect(page.getByTestId('sim-log')).toContainText('enter warn')
  await page.waitForTimeout(500)
  expect(errors).toEqual([])
})

test('designer: bad JSON, missing fields and invalid note names are refused without a crash', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByTestId('unlock').click()
  await page.getByTestId('tab-designer').click()

  await page.getByTestId('dz-json').fill('{"kind":"synth"}')
  await page.getByRole('button', { name: '読み込む' }).click()
  await expect(page.getByTestId('dz-json-error')).toContainText('mode')
  await expect(page.getByTestId('dz-json-error')).toContainText('envelope')
  await expect(page.getByTestId('error-boundary')).toHaveCount(0)
  await expect(page.getByTestId('dz-voice')).toBeVisible()

  await page.getByTestId('dz-json').fill('not json at all')
  await page.getByRole('button', { name: '読み込む' }).click()
  await expect(page.getByTestId('dz-json-error')).toContainText('JSON')

  // invalid note name through the form: preview is disabled and the reason shown
  await page.getByTestId('twin-sonar').click()
  await page.getByLabel('base').fill('X9')
  await expect(page.getByTestId('dz-spec-errors')).toContainText('pitch.base')
  await expect(page.getByTestId('dz-toggle')).toBeDisabled()
  await page.getByLabel('base').fill('A5')
  await expect(page.getByTestId('dz-toggle')).toBeEnabled()

  // empty save name is refused
  await page.getByTestId('dz-name').fill('   ')
  await expect(page.getByTestId('dz-save')).toBeDisabled()
  expect(errors).toEqual([])
})
