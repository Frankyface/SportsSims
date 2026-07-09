// Spike runner: start a Vite dev server, drive /headless.html in a headless
// browser, wait for the export to finish, and capture the downloaded MP4.
//
// Proves a headless browser can run the app's own deterministic sim + WebCodecs
// MP4 export with zero UI — the linchpin for hands-off Rung-4 auto-posting.
//
// Usage:
//   node scripts/headless-export.mjs            # bundled Chromium (mirrors GitHub Actions)
//   PW_CHANNEL=chrome node scripts/headless-export.mjs   # installed Chrome/Edge (guaranteed H.264)
//
// Exit 0 + a saved headless-export.mp4 = pass. Non-zero = the harness reported an error.

import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outFile = path.join(projectRoot, 'headless-export.mp4')
const TIMEOUT_MS = 10 * 60 * 1000

const channel = process.env.PW_CHANNEL || null

const server = await createServer({
  root: projectRoot,
  configFile: path.join(projectRoot, 'vite.config.ts'),
  server: { port: 5199, strictPort: true },
  logLevel: 'warn',
})
await server.listen()
const base = (server.resolvedUrls?.local?.[0] || 'http://localhost:5199/').replace(/\/$/, '')
console.log(`[runner] vite dev server: ${base}`)
console.log(`[runner] launching ${channel ? `channel=${channel}` : 'bundled chromium'} (headless)`)

let browser
try {
  browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) })
} catch (err) {
  console.error('[runner] browser launch failed:', err.message)
  await server.close()
  process.exit(2)
}

const context = await browser.newContext({ acceptDownloads: true })
const page = await context.newPage()
page.on('console', (m) => console.log(`[page:${m.type()}]`, m.text()))
page.on('pageerror', (e) => console.log('[page:error]', e.message))

const downloadPromise = page.waitForEvent('download', { timeout: TIMEOUT_MS }).catch(() => null)

const t0 = Date.now()
await page.goto(`${base}/headless.html`, { waitUntil: 'load', timeout: 60000 })
await page.waitForFunction(() => window.__DONE__ === true, null, { timeout: TIMEOUT_MS, polling: 500 })

const info = await page.evaluate(() => ({
  hasWebCodecs: window.__HAS_WEBCODECS__,
  error: window.__ERROR__,
  size: window.__SIZE__,
  score: window.__SCORE__,
  progress: window.__PROGRESS__,
}))
const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`[runner] harness finished in ${elapsed}s:`, JSON.stringify(info))

let exitCode = 0
if (info.error) {
  console.error('[runner] EXPORT FAILED:\n' + info.error)
  exitCode = 1
} else {
  const download = await downloadPromise
  if (!download) {
    console.error('[runner] export reported success but no download was captured')
    exitCode = 1
  } else {
    await download.saveAs(outFile)
    console.log(`[runner] PASS — saved ${outFile} (score ${info.score?.join('-')}, ~${(info.size / 1e6).toFixed(1)} MB)`)
  }
}

await browser.close()
await server.close()
process.exit(exitCode)
