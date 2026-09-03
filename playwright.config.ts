import { defineConfig, devices } from '@playwright/test'

/**
 * Real-browser tests against apps/demo (spec §4.5, §8 M5, §9 leak check).
 * Chromium only (D4). Autoplay is unlocked so `Tone.start()` succeeds headless;
 * `--expose-gc` lets the leak test force collections between measurements.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'],
        },
      },
    },
    {
      name: 'background',
      testMatch: /background\.e2e\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--autoplay-policy=no-user-gesture-required'],
        },
      },
    },
  ],
  webServer: {
    command: 'bun run --bun --filter demo dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
