// Spike runner: start a Vite dev server, drive /headless.html in a headless
// browser, and capture the outputs it downloads — a VIDEO-ONLY MP4 plus the
// soundtrack as a WAV. (The workflow ffmpeg-muxes them into a final MP4 with
// AAC audio, because Linux CI Chromium can't encode AAC.)
//
// Usage:
//   node scripts/headless-export.mjs                       # bundled Chromium (mirrors CI)
//   PW_CHANNEL=chrome node scripts/headless-export.mjs     # installed Chrome/Edge
//
// Exit 0 + headless-export.mp4 + headless-export.wav = pass.

import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
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

const saves = []
page.on('download', (d) => {
  const name = d.suggestedFilename()
  saves.push(
    d
      .saveAs(path.join(projectRoot, name))
      .then(() => name)
      .catch((e) => `FAILED ${name}: ${e.message}`),
  )
})

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
console.log(`[runner] harness finished in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, JSON.stringify(info))

let exitCode = 0
if (info.error) {
  console.error('[runner] EXPORT FAILED:\n' + info.error)
  exitCode = 1
} else {
  await new Promise((r) => setTimeout(r, 1500)) // let both download events register + save
  console.log('[runner] saved:', (await Promise.all(saves)).join(', '))
  const ok = ['headless-export.mp4', 'headless-export.wav'].every((f) => fs.existsSync(path.join(projectRoot, f)))
  if (!ok) {
    console.error('[runner] missing an expected output file')
    exitCode = 1
  } else {
    console.log(`[runner] PASS — video (${(info.size / 1e6).toFixed(1)} MB, score ${info.score?.join('-')}) + WAV`)
  }
}

await browser.close()
await server.close()
process.exit(exitCode)
