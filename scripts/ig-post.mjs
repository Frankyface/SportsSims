// Posts a set of pre-generated images to Instagram via the Content Publishing API
// (graph.instagram.com). Reads manifest.json produced by headless-images.mjs and
// routes each image to its account by manifest `account` field.
//
// Usage: node scripts/ig-post.mjs <imagesDir> <publicBaseUrl>
//   imagesDir     dir containing the PNGs + manifest.json
//   publicBaseUrl public URL the images are hosted under (e.g. a raw.githubusercontent path)
//
// Secrets via env: IG_USER_ID_SOCCER / IG_ACCESS_TOKEN_SOCCER / IG_USER_ID_GOLF / IG_ACCESS_TOKEN_GOLF
// NEVER logs a token. Exits non-zero if any post fails.

import fs from 'node:fs'
import path from 'node:path'

const imagesDir = process.argv[2]
const baseUrl = (process.argv[3] || '').replace(/\/+$/, '')
if (!imagesDir || !baseUrl) {
  console.error('usage: node scripts/ig-post.mjs <imagesDir> <publicBaseUrl>')
  process.exit(2)
}

const API = 'https://graph.instagram.com'
const manifest = JSON.parse(fs.readFileSync(path.join(imagesDir, 'manifest.json'), 'utf8'))
const account = {
  soccer: { id: process.env.IG_USER_ID_SOCCER, tok: process.env.IG_ACCESS_TOKEN_SOCCER },
  golf: { id: process.env.IG_USER_ID_GOLF, tok: process.env.IG_ACCESS_TOKEN_GOLF },
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Confirm the image is publicly served as an image before asking Instagram to fetch it.
async function ensureReachable(url) {
  for (let i = 0; i < 12; i++) {
    try {
      const r = await fetch(url)
      const ct = r.headers.get('content-type') || ''
      if (r.ok && ct.startsWith('image/')) {
        console.log(`  host OK (${ct})`)
        return true
      }
      console.log(`  waiting for host… (status ${r.status}, type "${ct}")`)
    } catch (e) {
      console.log(`  host not ready: ${e.message}`)
    }
    await sleep(4000)
  }
  return false
}

async function api(idPath, params) {
  const r = await fetch(`${API}/${idPath}`, { method: 'POST', body: new URLSearchParams(params) })
  return r.json()
}

async function createContainer(id, tok, imageUrl, caption) {
  const j = await api(`${id}/media`, { image_url: imageUrl, caption, access_token: tok })
  if (!j.id) throw new Error(`container: ${JSON.stringify(j.error || j)}`)
  return j.id
}

async function publish(id, tok, creationId) {
  for (let i = 0; i < 6; i++) {
    const j = await api(`${id}/media_publish`, { creation_id: creationId, access_token: tok })
    if (j.id) return j.id
    console.log(`  publish attempt ${i + 1}: ${JSON.stringify(j.error || j)}`)
    await sleep(5000)
  }
  throw new Error('publish failed after retries')
}

let failures = 0
for (const item of manifest) {
  const acct = account[item.account]
  const imageUrl = `${baseUrl}/${item.file}`
  console.log(`\n=== ${item.account.toUpperCase()} · ${item.name} ===`)
  console.log(`  image: ${imageUrl}`)
  if (!acct || !acct.id || !acct.tok) {
    console.log(`  ❌ FAILED: missing secrets for account "${item.account}"`)
    failures++
    continue
  }
  try {
    if (!(await ensureReachable(imageUrl))) throw new Error('image URL not publicly reachable as image/*')
    const cid = await createContainer(acct.id, acct.tok, imageUrl, item.caption)
    console.log(`  container ${cid}`)
    await sleep(3000) // let the container settle before publishing
    const mediaId = await publish(acct.id, acct.tok, cid)
    console.log(`  ✅ PUBLISHED — media id ${mediaId}`)
  } catch (e) {
    console.log(`  ❌ FAILED: ${e.message}`)
    failures++
  }
  await sleep(2000) // gentle spacing between posts
}

console.log(`\n----------------------------------------`)
console.log(`${manifest.length - failures}/${manifest.length} posts published.`)
process.exit(failures ? 1 : 0)
