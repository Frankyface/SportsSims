// Read/advance the daily cadence cursor, stored as state.json on a dedicated
// branch (default: automation-state) via the GitHub Contents API — so no branch
// checkouts collide with the main working tree or the orphan host branch.
//
// state.json shape:
//   { enabled: boolean,
//     soccer: { season: number, day: number, rolls: string[] },
//     golf:   { season: number, day: number, rolls: string[] } }
//   enabled — master pause switch; scheduled runs only post when true.
//   season/day — which season + 0-based day the account posts NEXT.
//   rolls   — result-seeds chosen at each season transition (rolls[k] → season k+2);
//             lets seasonReconstruct rebuild any season deterministically.
//
// Usage:
//   node scripts/cadence-state.mjs read                    # emit enabled/state_b64/sha
//   node scripts/cadence-state.mjs advance <manifest.json> # write manifest.cursor
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, STATE_BRANCH (default automation-state).

import fs from 'node:fs'

const token = process.env.GITHUB_TOKEN
const repo = process.env.GITHUB_REPOSITORY
const branch = process.env.STATE_BRANCH || 'automation-state'
if (!token || !repo) { console.error('GITHUB_TOKEN and GITHUB_REPOSITORY are required'); process.exit(2) }

const API = `https://api.github.com/repos/${repo}/contents/state.json`
const HEADERS = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
const DEFAULT = {
  enabled: false,
  soccer: { season: 1, day: 0, rolls: [], postedHWM: -1 },
  golf: { season: 1, day: 0, rolls: [], postedHWM: -1 },
}

/** Normalize any older shape ({soccer:{nextDay}}) into the current one. */
function normalize(s) {
  const one = (x) => ({
    season: Number.isInteger(x?.season) ? x.season : 1,
    day: Number.isInteger(x?.day) ? x.day : Number.isInteger(x?.nextDay) ? x.nextDay : 0,
    rolls: Array.isArray(x?.rolls) ? x.rolls.map(String) : [],
    postedHWM: Number.isFinite(x?.postedHWM) ? x.postedHWM : -1,
  })
  return { enabled: s?.enabled === true, soccer: one(s?.soccer), golf: one(s?.golf) }
}

async function getState() {
  const r = await fetch(`${API}?ref=${encodeURIComponent(branch)}`, { headers: HEADERS })
  if (r.status === 404) return { state: DEFAULT, sha: null }
  if (!r.ok) throw new Error(`read failed ${r.status}: ${await r.text()}`)
  const j = await r.json()
  return { state: normalize(JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'))), sha: j.sha }
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
  const b64 = Buffer.from(JSON.stringify({ soccer: state.soccer, golf: state.golf })).toString('base64')
  const lines = [`enabled=${state.enabled === true}`, `state_b64=${b64}`, `sha=${sha || ''}`]
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n')
  console.log(`enabled=${state.enabled} soccer=S${state.soccer.season}/d${state.soccer.day} golf=S${state.golf.season}/d${state.golf.day}`)
} else if (cmd === 'advance') {
  const manifestPath = process.argv[3]
  if (!manifestPath) { console.error('advance needs a manifest path'); process.exit(2) }
  const cursor = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).cursor
  const ok = (c) => c && Number.isInteger(c.season) && Number.isInteger(c.day) && Array.isArray(c.rolls)
  if (!ok(cursor?.soccer) || !ok(cursor?.golf)) throw new Error(`manifest has no valid cursor: ${JSON.stringify(cursor)}`)
  const { state, sha } = await getState()
  const next = { ...state, soccer: cursor.soccer, golf: cursor.golf }
  await putState(next, sha, `chore: advance cadence → soccer S${cursor.soccer.season}/d${cursor.soccer.day}, golf S${cursor.golf.season}/d${cursor.golf.day} [skip ci]`)
  console.log(`cursor advanced: soccer S${cursor.soccer.season}/d${cursor.soccer.day}, golf S${cursor.golf.season}/d${cursor.golf.day}`)
} else {
  console.error('usage: cadence-state.mjs read | advance <manifest.json>')
  process.exit(2)
}
