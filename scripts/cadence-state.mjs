// Read/advance the daily cadence cursor, stored as state.json on a dedicated
// branch (default: automation-state) via the GitHub Contents API — so no branch
// checkouts collide with the main working tree or the orphan host branch.
//
// state.json shape: { enabled: boolean, soccer: { nextDay: number }, golf: { nextDay: number } }
//   enabled  — master pause switch; the scheduled cron only posts when true.
//   nextDay  — 0-based day index the account posts NEXT (see src/headless/dailyCalendar.ts).
//
// Usage:
//   node scripts/cadence-state.mjs read                    # emit enabled/soccer/golf/sha to $GITHUB_OUTPUT
//   node scripts/cadence-state.mjs advance <manifest.json> # write cursor from the manifest's cursor field
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, STATE_BRANCH (default automation-state).

import fs from 'node:fs'

const token = process.env.GITHUB_TOKEN
const repo = process.env.GITHUB_REPOSITORY
const branch = process.env.STATE_BRANCH || 'automation-state'
if (!token || !repo) { console.error('GITHUB_TOKEN and GITHUB_REPOSITORY are required'); process.exit(2) }

const API = `https://api.github.com/repos/${repo}/contents/state.json`
const HEADERS = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
const DEFAULT = { enabled: false, soccer: { nextDay: 0 }, golf: { nextDay: 0 } }

async function getState() {
  const r = await fetch(`${API}?ref=${encodeURIComponent(branch)}`, { headers: HEADERS })
  if (r.status === 404) return { state: DEFAULT, sha: null }
  if (!r.ok) throw new Error(`read failed ${r.status}: ${await r.text()}`)
  const j = await r.json()
  return { state: JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')), sha: j.sha }
}

async function putState(state, sha, message) {
  const body = { message, branch, content: Buffer.from(JSON.stringify(state, null, 2) + '\n').toString('base64') }
  if (sha) body.sha = sha
  const r = await fetch(API, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`write failed ${r.status}: ${await r.text()}`)
}

const cmd = process.argv[2]
if (cmd === 'read') {
  const { state, sha } = await getState()
  const lines = [
    `enabled=${state.enabled === true}`,
    `soccer=${state.soccer?.nextDay ?? 0}`,
    `golf=${state.golf?.nextDay ?? 0}`,
    `sha=${sha || ''}`,
  ]
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n')
  console.log(lines.join(' '))
} else if (cmd === 'advance') {
  const manifestPath = process.argv[3]
  if (!manifestPath) { console.error('advance needs a manifest path'); process.exit(2) }
  const cursor = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).cursor
  if (!cursor || typeof cursor.soccer !== 'number' || typeof cursor.golf !== 'number') {
    throw new Error(`manifest has no valid cursor: ${JSON.stringify(cursor)}`)
  }
  const { state, sha } = await getState()
  const next = { ...state, soccer: { nextDay: cursor.soccer }, golf: { nextDay: cursor.golf } }
  await putState(next, sha, `chore: advance cadence cursor → soccer ${cursor.soccer}, golf ${cursor.golf} [skip ci]`)
  console.log(`cursor advanced: soccer ${cursor.soccer}, golf ${cursor.golf}`)
} else {
  console.error('usage: cadence-state.mjs read | advance <manifest.json>')
  process.exit(2)
}
