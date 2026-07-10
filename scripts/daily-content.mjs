// Runner for the DAILY cadence: start Vite, drive /headless-daily.html for the
// given per-account day cursors, and capture every downloaded asset (video-only
// MP4s + WAV sidecars + PNGs) plus manifest.json (which also carries the advanced
// cursor for the workflow to persist).
//
// Usage: node scripts/daily-content.mjs <outDir> <soccerDay> <golfDay> [catchup]
//   catchup — render the one-off seed-drop gap posts instead of a calendar day
//             (cursor comes back unchanged).

import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = process.argv[2] || path.join(projectRoot, 'content-out')
const soccerDay = process.argv[3]
const golfDay = process.argv[4]
const isCatchup = process.argv[5] === 'catchup'
if (soccerDay === undefined || golfDay === undefined) {
  console.error('usage: node scripts/daily-content.mjs <outDir> <soccerDay> <golfDay> [catchup]')
  process.exit(2)
}
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
console.log(`[runner] cursors: soccerDay=${soccerDay} golfDay=${golfDay}`)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on('console', (m) => console.log(`[page:${m.type()}]`, m.text()))
page.on('pageerror', (e) => console.log('[page:error]', e.message))

// The page saves files through this binding (chunked base64), NOT via browser
// downloads — Chromium's automatic-download limiter silently drops rapid bursts
// past ~10 clicks, which lost trailing carousel images.
await page.exposeFunction('__SAVE_CHUNK__', (filename, b64, isFirst) => {
  const safe = path.basename(String(filename))
  const buf = Buffer.from(String(b64), 'base64')
  const target = path.join(outDir, safe)
  if (isFirst) fs.writeFileSync(target, buf)
  else fs.appendFileSync(target, buf)
})

const t0 = Date.now()
const catchupParam = isCatchup ? '&catchup=1' : ''
const url = `${base}/headless-daily.html?soccerDay=${encodeURIComponent(soccerDay)}&golfDay=${encodeURIComponent(golfDay)}${catchupParam}`
await page.goto(url, { waitUntil: 'load', timeout: 60000 })
await page.waitForFunction(() => window.__DONE__ === true, null, { timeout: TIMEOUT_MS, polling: 1000 })

const err = await page.evaluate(() => window.__ERROR__)
if (err) {
  console.error('[runner] GENERATION FAILED:\n' + err)
  await browser.close(); await server.close(); process.exit(1)
}

const manifest = await page.evaluate(() => window.__MANIFEST__)
fs.writeFileSync(path.join(outDir, 'manifest.json'), manifest || '{"posts":[]}')
const parsed = JSON.parse(manifest || '{"posts":[]}')

// Every file the manifest references MUST land on disk — downloads queue and
// can trail the page's __DONE__, so wait for the full set (not a blind sleep).
const expected = new Set()
for (const p of parsed.posts) {
  if (p.video) {
    expected.add(p.video)
    expected.add(p.video.replace(/\.mp4$/, '.wav'))
  }
  if (p.board) expected.add(p.board)
  if (p.image) expected.add(p.image)
  for (const img of p.images ?? []) expected.add(img)
}
const missing = () => [...expected].filter((f) => !fs.existsSync(path.join(outDir, f)))
const deadline = Date.now() + 120_000
while (missing().length > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 1000))

const stillMissing = missing()
if (stillMissing.length > 0) {
  console.error(`[runner] MISSING ${stillMissing.length}/${expected.size} files: ${stillMissing.join(', ')}`)
  await browser.close(); await server.close(); process.exit(1)
}
console.log(`[runner] saved all ${expected.size} manifest files in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
console.log(`[runner] manifest: ${parsed.posts.length} posts; next cursor ${JSON.stringify(parsed.cursor)}`)
for (const p of parsed.posts) {
  const detail = p.kind === 'carousel' ? p.images.length + ' images' : p.kind === 'photo' ? p.image : p.video + ' + ' + p.board
  console.log(`  #${p.order} ${p.account} (${p.kind}): ${detail}`)
}

await browser.close()
await server.close()
process.exit(0)
