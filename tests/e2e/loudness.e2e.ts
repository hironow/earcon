import { expect, test } from '@playwright/test'

/**
 * Every preset must be audible and must not clip. Rendered offline with Tone.Offline
 * (real synthesis, no speakers): peak in dBFS per preset. Found by ear on 2026-09-04:
 * stallWarning was ~25 dB below its neighbours and gong clipped at +5.6 dBFS.
 */
test('all 28 presets peak between -30 and -1 dBFS', async ({ page }) => {
  test.slow()
  await page.goto('/')
  await page.getByTestId('unlock').click()
  await expect(page.getByTestId('status')).toHaveAttribute('data-status', 'ready')
  const peaks = await page.evaluate(async () => {
    const Tone = await window.__earcon!.tone()
    const { continuous, oneShot } = await window.__earcon!.presets()
    const peakOf = async (build: (out: unknown) => void, seconds: number) => {
      const buffer = await Tone.Offline(() => build(Tone.getDestination()), seconds)
      const ch = buffer.getChannelData(0)
      let peak = 0
      for (let i = 0; i < ch.length; i++) {
        const a = Math.abs(ch[i]!)
        if (a > peak) peak = a
      }
      return 20 * Math.log10(peak)
    }
    const out: Record<string, number> = {}
    type AnySound = { start?(i: number): void; play?(o?: { time?: number }): void }
    type Factory = (ctx: { out: unknown }) => AnySound
    for (const [id, f] of Object.entries(continuous)) {
      out[`${id}@0.9`] = await peakOf((o) => (f as Factory)({ out: o }).start!(0.9), 3)
    }
    for (const [id, f] of Object.entries(oneShot)) {
      out[id] = await peakOf((o) => (f as Factory)({ out: o }).play!({ time: 0.05 }), 2)
    }
    return out
  })
  const tooQuiet = Object.entries(peaks).filter(([, p]) => p < -30).map(([k, p]) => `${k}: ${p.toFixed(1)} dBFS`)
  const clipping = Object.entries(peaks).filter(([, p]) => p > -1).map(([k, p]) => `${k}: ${p.toFixed(1)} dBFS`)
  expect(Object.keys(peaks)).toHaveLength(28)
  expect(tooQuiet).toEqual([])
  expect(clipping).toEqual([])
})
