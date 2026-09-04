import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const src = (pkg: string) => fileURLToPath(new URL(`../../packages/${pkg}/src/index.ts`, import.meta.url))

export default defineConfig({
  // GitHub Pages serves the demo under /earcon/; local dev and Playwright use /.
  base: process.env.DEMO_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@earcon/core': src('core'),
      '@earcon/engine-tone': src('engine-tone'),
      '@earcon/react': src('react'),
    },
  },
})
