# e2e (Playwright, Chromium)

Real Web Audio, real Tone.js, real demo app. No mocks.

- Once per machine: `bunx playwright install chromium`
- Run: `just test-e2e` (starts the Vite demo on :5173 by itself)
- Projects: `chromium` runs every `*.e2e.ts` except `background.e2e.ts`; the
  `background` project runs the 90-second hidden-tab check (spec §8 M5)
- The demo exposes `window.__earcon` in dev mode (`apps/demo/src/debug.ts`) so
  tests can reach the engine and Tone without touching the UI internals
