import { expect, test, type Page } from '@playwright/test'

/**
 * Phones, foldables (closed and open), a dual-screen and tablets: no horizontal
 * overflow on any tab, and on touch devices every control is at least 44 px tall.
 */
const VIEWPORTS: Array<{ name: string; width: number; height: number; touch: boolean }> = [
  { name: 'iPhone', width: 390, height: 844, touch: true },
  { name: 'Android', width: 360, height: 800, touch: true },
  { name: 'Fold closed', width: 344, height: 882, touch: true },
  { name: 'Fold open', width: 884, height: 1104, touch: true },
  { name: 'Surface Duo', width: 540, height: 720, touch: true },
  { name: 'iPad portrait', width: 820, height: 1180, touch: true },
  { name: 'iPad landscape', width: 1180, height: 820, touch: true },
  { name: 'Desktop', width: 1280, height: 900, touch: false },
]
const TABS = ['auditioner', 'simulator', 'designer', 'wallets']

async function audit(page: Page, width: number) {
  return page.evaluate((vw) => {
    const doc = document.documentElement
    const wide = [...document.querySelectorAll('main *, header *')]
      .filter((el) => !el.closest('.tabs') && !el.closest('.levels-scroll'))
      .filter((el) => {
        const b = el.getBoundingClientRect()
        return b.width > 0 && (b.right > vw + 1 || b.left < -1)
      })
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`)
    const small = [...document.querySelectorAll('main button, main input, main select, header button, header input')]
      .filter((el) => {
        const b = el.getBoundingClientRect()
        return b.width > 0 && b.height < 44
      })
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`)
    return { overflow: doc.scrollWidth - doc.clientWidth, wide: [...new Set(wide)], small: [...new Set(small)] }
  }, width)
}

for (const vp of VIEWPORTS) {
  test(`${vp.name} (${vp.width}×${vp.height}): no overflow, tap targets ok`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.touch, hasTouch: vp.touch })
    const page = await context.newPage()
    await page.goto('/')
    await page.getByTestId('unlock').click()
    for (const tab of TABS) {
      await page.getByTestId(`tab-${tab}`).click()
      await page.waitForTimeout(150)
      const r = await audit(page, vp.width)
      expect(r.overflow, `${tab}: horizontal overflow`).toBeLessThanOrEqual(0)
      expect(r.wide, `${tab}: elements wider than the viewport`).toEqual([])
      if (vp.touch) expect(r.small, `${tab}: controls under 44 px`).toEqual([])
    }
    await context.close()
  })
}
