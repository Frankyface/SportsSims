// Diagnostic: try to make Instagram INGEST an already-hosted video (create a
// container only — does NOT publish, so nothing goes live), and record IG's exact
// response. Writes diag-result.txt so the outcome can be read without auth.
//
// Usage: node scripts/ig-diag.mjs <publicBaseUrl>

import fs from 'node:fs'

const base = (process.argv[2] || '').replace(/\/+$/, '')
const A = { id: process.env.IG_USER_ID_SOCCER, tok: process.env.IG_ACCESS_TOKEN_SOCCER }
const out = []
const log = (s) => { out.push(String(s)); console.log(String(s)) }

async function reach(url) {
  try {
    const r = await fetch(url)
    return `${r.status} ct=${r.headers.get('content-type')} len=${r.headers.get('content-length')}`
  } catch (e) { return 'ERR ' + e.message }
}
async function mediaPost(id, tok, params) {
  const r = await fetch(`https://graph.instagram.com/${id}/media`, { method: 'POST', body: new URLSearchParams({ ...params, access_token: tok }) })
  return r.json()
}

const v = `${base}/soccer-r1-m1.mp4`
log('base: ' + base)
log('video reachability: ' + (await reach(v)))
log('image reachability: ' + (await reach(`${base}/golf-e1-preview-00.png`)))
log('--- create VIDEO carousel-item container from raw video ---')
log(JSON.stringify(await mediaPost(A.id, A.tok, { media_type: 'VIDEO', video_url: v, is_carousel_item: 'true' })))
log('--- create REELS container from raw video ---')
log(JSON.stringify(await mediaPost(A.id, A.tok, { media_type: 'REELS', video_url: v, caption: 'diagnostic - not published' })))

fs.writeFileSync('diag-result.txt', out.join('\n') + '\n')
