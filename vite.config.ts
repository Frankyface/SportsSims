/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev serves at '/', production builds under '/SportsSims/' for GitHub Pages.
// fs.strict:false is a dev-only relaxation: the preview launcher runs Vite via an
// 8.3 short path, which otherwise fails Vite's serve allow-list (path canonicalization).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/SportsSims/' : '/',
  plugins: [react()],
  server: {
    fs: { strict: false },
  },
  test: {
    globals: true,
    environment: 'node',
  },
}))
