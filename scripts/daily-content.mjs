// Runner for the DAILY cadence: start Vite, drive /headless-daily.html for the
// given per-account day cursors, and capture every downloaded asset (video-only
// MP4s + WAV sidecars + PNGs) plus manifest.json (which also carries the advanced
// cursor for the workflow to persist).
//
// Usage: node scripts/daily-content.mjs <outDir> <stateJson> <slot> <mode> [catchup]
//   stateJson — the cadence state: {"soccer":{season,day,rolls,postedHWM},"golf":{...}}
//   slot      — g1 | main | companions (which posts to render this run)
//   mode      — live | dry-run (dry-run renders all content, ignores markers)
//   catchup   — render the one-off seed-drop gap posts (cursor unchanged)

import { chromium } from 'playwright'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = process.argv[2] || path.join(projectRoot, 'content-out')
const stateJson = process.argv[3]
const slot = process.argv[4] || 'companions'
const mode = process.argv[5] || 'live'
const isCatchup = process.argv[6] === 'catchup'
const isDry = mode === 'dry-run'
if (!stateJson) {
  console.error('usage: node scripts/daily-content.mjs <outDir> <stateJson> <slot> <mode> [catchup]')
  process.exit(2)
}
let state
try {
  state = JSON.parse(stateJson)
} catch (e) {
  console.error('[runner] bad stateJson:', e.message)
  process.exit(2)
}
const soccer = state.soccer || { season: 1, day: -1, rolls: [], postedHWM: -1 }
const golf = state.golf || { season: 1, day: -1, rolls: [], postedHWM: -1 }
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
console.log(`[runner] slot=${slot} mode=${mode} soccer=S${soccer.season}/d${soccer.day} golf=S${golf.season}/d${golf.day}${isCatchup ? ' (catchup)' : ''}`)

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
const q = new URLSearchParams({
  slot,
  dry: isDry ? '1' : '0',
  soccer: JSON.stringify(soccer),
  golf: JSON.stringify(golf),
})
if (isCatchup) q.set('catchup', '1')
const url = `${base}/headless-daily.html?${q.toString()}`
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
