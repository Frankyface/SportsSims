// Posts carousels to Instagram from a manifest.json produced by the content
// generator. Each post's items become carousel children (image_url or, for
// videos, media_type=VIDEO with status polling), then a CAROUSEL container is
// published. Routes each post to its account and posts in (account, order).
//
// Usage: node scripts/ig-post-carousel.mjs <dir> <publicBaseUrl>
// Secrets via env: IG_USER_ID_SOCCER/GOLF, IG_ACCESS_TOKEN_SOCCER/GOLF. Never logs a token.

import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
const baseUrl = (process.argv[3] || '').replace(/\/+$/, '')
if (!dir || !baseUrl) {
  console.error('usage: node scripts/ig-post-carousel.mjs <dir> <publicBaseUrl>')
  process.exit(2)
}

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

async function ensureReachable(url, type) {
  for (let i = 0; i < 15; i++) {
    try {
      const r = await fetch(url)
      const ct = r.headers.get('content-type') || ''
      // images must be image/*; videos accept video/* or a generic binary type (raw.githubusercontent).
      const ok = r.ok && (type === 'image' ? ct.startsWith('image/') : ct.startsWith('video/') || ct.startsWith('application/octet-stream'))
      if (ok) { console.log(`   host OK ${path.basename(url)} (${ct})`); return true }
      console.log(`   waiting host ${path.basename(url)} (${r.status} ${ct})`)
    } catch (e) {
      console.log(`   host not ready ${path.basename(url)}: ${e.message}`)
    }
    await sleep(4000)
  }
  return false
}

async function waitFinished(igId, tok, containerId, label) {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${API}/${containerId}?fields=status_code&access_token=${tok}`)
    const j = await r.json()
    if (j.status_code === 'FINISHED') return
    if (j.status_code === 'ERROR' || j.error) throw new Error(`${label} error: ${JSON.stringify(j.error || j)}`)
    console.log(`   ${label} processing… (${j.status_code || '?'})`)
    await sleep(5000)
  }
  throw new Error(`${label} not FINISHED in time`)
}

async function createChild(igId, tok, item, url) {
  const params =
    item.type === 'video'
      ? { media_type: 'VIDEO', video_url: url, is_carousel_item: 'true', access_token: tok }
      : { image_url: url, is_carousel_item: 'true', access_token: tok }
  const j = await api(`${igId}/media`, params)
  if (!j.id) throw new Error(`child ${item.file}: ${JSON.stringify(j.error || j)}`)
  if (item.type === 'video') await waitFinished(igId, tok, j.id, `video ${item.file}`)
  return j.id
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

const posts = manifest.posts.slice().sort((a, b) => a.account.localeCompare(b.account) || a.order - b.order)
let failures = 0
for (const post of posts) {
  const acct = account[post.account]
  console.log(`\n=== ${post.account.toUpperCase()} #${post.order} — ${post.items.length} items ===`)
  if (!acct || !acct.id || !acct.tok) {
    console.log(`   ❌ missing secrets for ${post.account}`)
    failures++
    continue
  }
  try {
    const children = []
    for (const item of post.items) {
      const url = `${baseUrl}/${item.file}`
      if (!(await ensureReachable(url, item.type))) throw new Error(`unreachable ${item.file}`)
      children.push(await createChild(acct.id, acct.tok, item, url))
    }
    const carousel = await api(`${acct.id}/media`, {
      media_type: 'CAROUSEL',
      children: children.join(','),
      caption: post.caption,
      access_token: acct.tok,
    })
    if (!carousel.id) throw new Error(`carousel: ${JSON.stringify(carousel.error || carousel)}`)
    await waitFinished(acct.id, acct.tok, carousel.id, 'carousel')
    await sleep(2000)
    const mediaId = await publish(acct.id, acct.tok, carousel.id)
    console.log(`   ✅ PUBLISHED media ${mediaId}`)
  } catch (e) {
    console.log(`   ❌ FAILED: ${e.message}`)
    failures++
  }
  await sleep(3000)
}

console.log(`\n----------------------------------------`)
console.log(`${posts.length - failures}/${posts.length} carousels published.`)
process.exit(failures ? 1 : 0)
