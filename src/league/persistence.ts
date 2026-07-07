// Persistence: localStorage is the instant working cache; a JSON file in the
// dedicated `elitesim-data` repo (via the GitHub Contents API) is the durable,
// versioned source of truth. See docs/research-findings.md §3.

import type { LeagueState } from './types'

const LS_LEAGUE = 'elitesim:league:'
const LS_SETTINGS = 'elitesim:settings'

// --- Base64 that survives non-Latin-1 characters (accented names, emoji) ---
export function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
export function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// --- localStorage working cache ---
export function saveLocal(state: LeagueState): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LS_LEAGUE + state.id, JSON.stringify(state))
}
export function loadLocal(id: string): LeagueState | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(LS_LEAGUE + id)
  return raw ? (JSON.parse(raw) as LeagueState) : null
}
export function listLocal(): string[] {
  if (typeof localStorage === 'undefined') return []
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(LS_LEAGUE)) out.push(k.slice(LS_LEAGUE.length))
  }
  return out
}

// --- Settings (GitHub token + data repo) ---
export interface Settings {
  token: string
  owner: string
  repo: string
}
export function saveSettings(s: Settings): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s))
}
export function loadSettings(): Settings | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(LS_SETTINGS)
  return raw ? (JSON.parse(raw) as Settings) : null
}

// --- GitHub Contents API (durable store) ---
function contentsUrl(s: Settings, path: string): string {
  return `https://api.github.com/repos/${s.owner}/${s.repo}/contents/${path}`
}
function authHeaders(s: Settings): Record<string, string> {
  return { Authorization: `Bearer ${s.token}`, Accept: 'application/vnd.github+json' }
}

export async function testConnection(s: Settings): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${s.owner}/${s.repo}`, { headers: authHeaders(s) })
    if (res.ok) return { ok: true, message: `Connected to ${s.owner}/${s.repo}.` }
    return { ok: false, message: `GitHub responded ${res.status}. Check the token scope and repo name.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

/** Load a league (and its blob sha for later updates) from the data repo. */
export async function loadFromRepo(s: Settings, id: string): Promise<{ state: LeagueState; sha: string } | null> {
  const res = await fetch(contentsUrl(s, `leagues/${id}.json`), { headers: authHeaders(s) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`)
  const data = (await res.json()) as { content: string; sha: string }
  return { state: JSON.parse(fromBase64(data.content)) as LeagueState, sha: data.sha }
}

/** Save a league to the data repo. Pass the current blob sha when updating. */
export async function saveToRepo(s: Settings, state: LeagueState, sha?: string): Promise<string> {
  const body = {
    message: `Update ${state.name} — season ${state.season}`,
    content: toBase64(JSON.stringify(state)),
    ...(sha ? { sha } : {}),
  }
  const res = await fetch(contentsUrl(s, `leagues/${state.id}.json`), {
    method: 'PUT',
    headers: { ...authHeaders(s), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GitHub save failed: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { content: { sha: string } }
  return data.content.sha
}
