// Posts a manifest of reels + image carousels to Instagram, routed per account,
// in (account, order). Reels → media_type=REELS (single video). Carousels →
// CAROUSEL of images. Video containers are polled to FINISHED before publishing.
//
// Usage: node scripts/ig-post.mjs <dir> <publicBaseUrl>
// Secrets: IG_USER_ID_SOCCER/GOLF, IG_ACCESS_TOKEN_SOCCER/GOLF. Never logs a token.

import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
const baseUrl = (process.argv[3] || '').replace(/\/+$/, '')
if (!dir || !baseUrl) { console.error('usage: node scripts/ig-post.mjs <dir> <publicBaseUrl>'); process.exit(2) }

const API = 'https://graph.instagram.com'
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
const account = {
  soccer: { id: process.env.IG_USER_ID_SOCCER, tok: process.env.IG_ACCESS_TOKEN_SOCCER },
  golf: { id: process.env.IG_USER_ID_GOLF, tok: process.env.IG_ACCESS_TOKEN_GOLF },
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(idPath, params) {
  const r = await fetch(`${API}/${idPath}`, { method: 'POST', body: new URLSearchParams(params) })
  return r.json()
}
async function reachable(url) {
  for (let i = 0; i < 15; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) { console.log(`   host OK ${path.basename(url)} (${r.headers.get('content-type')})`); return true }
      console.log(`   waiting ${path.basename(url)} (${r.status})`)
    } catch (e) { console.log(`   ${path.basename(url)} ${e.message}`) }
    await sleep(4000)
  }
  return false
}
async function waitFinished(tok, containerId, label) {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${API}/${containerId}?fields=status_code&access_token=${tok}`)
    const j = await r.json()
    if (j.status_code === 'FINISHED') return
    if (j.status_code === 'ERROR' || j.error) throw new Error(`${label}: ${JSON.stringify(j.error || j)}`)
    console.log(`   ${label} ${j.status_code || '?'}`)
    await sleep(5000)
  }
  throw new Error(`${label} not FINISHED in time`)
}
async function publish(igId, tok, creationId) {
  for (let i = 0; i < 8; i++) {
    const j = await api(`${igId}/media_publish`, { creation_id: creationId, access_token: tok })
    if (j.id) return j.id
    console.log(`   publish attempt ${i + 1}: ${JSON.stringify(j.error || j)}`)
    await sleep(6000)
  }
  throw new Error('publish failed after retries')
}

async function postReel(acct, post) {
  const url = `${baseUrl}/${post.video}`
  if (!(await reachable(url))) throw new Error(`unreachable ${post.video}`)
  const c = await api(`${acct.id}/media`, { media_type: 'REELS', video_url: url, caption: post.caption, access_token: acct.tok })
  if (!c.id) throw new Error(`reel container: ${JSON.stringify(c.error || c)}`)
  await waitFinished(acct.tok, c.id, `reel ${post.video}`)
  await sleep(2000)
  return publish(acct.id, acct.tok, c.id)
}
async function postPhoto(acct, post) {
  const url = `${baseUrl}/${post.image}`
  if (!(await reachable(url))) throw new Error(`unreachable ${post.image}`)
  const c = await api(`${acct.id}/media`, { image_url: url, caption: post.caption, access_token: acct.tok })
  if (!c.id) throw new Error(`photo container: ${JSON.stringify(c.error || c)}`)
  await sleep(2000)
  return publish(acct.id, acct.tok, c.id)
}
async function postCarousel(acct, post) {
  const children = []
  for (const img of post.images) {
    const url = `${baseUrl}/${img}`
    if (!(await reachable(url))) throw new Error(`unreachable ${img}`)
    const c = await api(`${acct.id}/media`, { image_url: url, is_carousel_item: 'true', access_token: acct.tok })
    if (!c.id) throw new Error(`item ${img}: ${JSON.stringify(c.error || c)}`)
    children.push(c.id)
  }
  const car = await api(`${acct.id}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption: post.caption, access_token: acct.tok })
  if (!car.id) throw new Error(`carousel: ${JSON.stringify(car.error || car)}`)
  await waitFinished(acct.tok, car.id, 'carousel')
  await sleep(2000)
  return publish(acct.id, acct.tok, car.id)
}

const posts = manifest.posts.slice().sort((a, b) => a.account.localeCompare(b.account) || a.order - b.order)
let failures = 0
for (const post of posts) {
  const acct = account[post.account]
  console.log(`\n=== ${post.account.toUpperCase()} #${post.order} (${post.kind}) ===`)
  if (!acct || !acct.id || !acct.tok) { console.log(`   ❌ missing secrets for ${post.account}`); failures++; continue }
  try {
    const id =
      post.kind === 'reel' ? await postReel(acct, post)
      : post.kind === 'photo' ? await postPhoto(acct, post)
      : await postCarousel(acct, post)
    console.log(`   ✅ PUBLISHED ${id}`)
  } catch (e) {
    console.log(`   ❌ FAILED: ${e.message}`)
    failures++
  }
  await sleep(3000)
}
console.log(`\n----------------------------------------`)
console.log(`${posts.length - failures}/${posts.length} published.`)
process.exit(failures ? 1 : 0)
