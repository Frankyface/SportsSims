// Runner: start Vite, drive /headless-content.html headlessly, and capture every
// downloaded asset (video-only MP4s + WAV sidecars + PNGs) plus manifest.json.
// The workflow then ffmpeg-muxes each MP4+WAV and posts the carousels.
//
// Usage: node scripts/headless-content.mjs [outDir]   (default: <project>/content-out)

import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = process.argv[2] || path.join(projectRoot, 'content-out')
const TIMEOUT_MS = 30 * 60 * 1000

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

const server = await createServer({
  root: projectRoot,
  configFile: path.join(projectRoot, 'vite.config.ts'),
  server: { port: 5199, strictPort: true },
  logLevel: 'warn',
})
await server.listen()
const base = (server.resolvedUrls?.local?.[0] || 'http://localhost:5199/').replace(/\/$/, '')
console.log(`[runner] vite dev server: ${base}`)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on('console', (m) => console.log(`[page:${m.type()}]`, m.text()))
page.on('pageerror', (e) => console.log('[page:error]', e.message))

const saves = []
page.on('download', (d) => {
  saves.push(
    d
      .saveAs(path.join(outDir, d.suggestedFilename()))
      .then(() => d.suggestedFilename())
      .catch((e) => `FAILED ${d.suggestedFilename()}: ${e.message}`),
  )
})

const t0 = Date.now()
await page.goto(`${base}/headless-content.html`, { waitUntil: 'load', timeout: 60000 })
await page.waitForFunction(() => window.__DONE__ === true, null, { timeout: TIMEOUT_MS, polling: 1000 })

const err = await page.evaluate(() => window.__ERROR__)
if (err) {
  console.error('[runner] GENERATION FAILED:\n' + err)
  await browser.close(); await server.close(); process.exit(1)
}

const manifest = await page.evaluate(() => window.__MANIFEST__)
fs.writeFileSync(path.join(outDir, 'manifest.json'), manifest || '{"posts":[]}')

await new Promise((r) => setTimeout(r, 4000)) // let downloads finish flushing to disk
const names = await Promise.all(saves)
console.log(`[runner] saved ${names.length} files in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
const posts = JSON.parse(manifest || '{"posts":[]}').posts
console.log(`[runner] manifest: ${posts.length} posts`)
for (const p of posts) console.log(`  #${p.order} ${p.account}: ${p.items.map((i) => i.file).join(' + ')}`)

await browser.close()
await server.close()
process.exit(0)
