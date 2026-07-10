// Refresh both Instagram long-lived access tokens (Instagram API with Instagram
// Login) and write the new tokens straight back into the GitHub Actions secrets,
// so posting never breaks on the 60-day expiry. Run weekly — each refresh extends
// the window another 60 days, so there's always huge margin.
//
// Refresh: GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token
//   → { access_token, expires_in }. A token must be 24h-60d old to refresh; the
//   weekly cadence guarantees that. NEVER logs a token value.
//
// Writing a secret needs libsodium sealed-box encryption with the repo's public
// key + a PAT that has "Secrets: write" (env GH_SECRETS_PAT). The default
// GITHUB_TOKEN cannot write secrets.
//
// Env: GH_SECRETS_PAT, GITHUB_REPOSITORY, IG_ACCESS_TOKEN_SOCCER, IG_ACCESS_TOKEN_GOLF.

import sodium from 'libsodium-wrappers'

const repo = process.env.GITHUB_REPOSITORY
const pat = process.env.GH_SECRETS_PAT
if (!repo || !pat) {
  console.error('GITHUB_REPOSITORY and GH_SECRETS_PAT are required')
  process.exit(2)
}
const GH = 'https://api.github.com'
const GH_H = { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
const IG = 'https://graph.instagram.com'

const accounts = [
  { label: 'soccer', secret: 'IG_ACCESS_TOKEN_SOCCER', token: process.env.IG_ACCESS_TOKEN_SOCCER },
  { label: 'golf', secret: 'IG_ACCESS_TOKEN_GOLF', token: process.env.IG_ACCESS_TOKEN_GOLF },
]

async function refresh(token) {
  const r = await fetch(`${IG}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`)
  const j = await r.json()
  if (!r.ok || !j.access_token) throw new Error(`refresh failed: ${JSON.stringify(j.error || j)}`)
  return { token: j.access_token, expiresInDays: Math.round((j.expires_in ?? 0) / 86400) }
}

async function getPublicKey() {
  const r = await fetch(`${GH}/repos/${repo}/actions/secrets/public-key`, { headers: GH_H })
  if (!r.ok) throw new Error(`public-key fetch failed ${r.status}: ${await r.text()}`)
  return r.json() // { key, key_id }
}

async function putSecret(name, value, pub) {
  await sodium.ready
  const encBytes = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(pub.key, sodium.base64_variants.ORIGINAL))
  const encrypted_value = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)
  const r = await fetch(`${GH}/repos/${repo}/actions/secrets/${name}`, {
    method: 'PUT',
    headers: GH_H,
    body: JSON.stringify({ encrypted_value, key_id: pub.key_id }),
  })
  if (!r.ok && r.status !== 204 && r.status !== 201) throw new Error(`secret PUT failed ${r.status}: ${await r.text()}`)
}

const pub = await getPublicKey()
let failures = 0
for (const a of accounts) {
  try {
    if (!a.token) throw new Error('current token secret is empty')
    const { token, expiresInDays } = await refresh(a.token)
    await putSecret(a.secret, token, pub)
    console.log(`✅ ${a.label}: refreshed → ${a.secret} updated (valid ~${expiresInDays} more days)`)
  } catch (e) {
    console.error(`❌ ${a.label}: ${e.message}`)
    failures++
  }
}
console.log(`\n${accounts.length - failures}/${accounts.length} tokens refreshed.`)
process.exit(failures ? 1 : 0)
