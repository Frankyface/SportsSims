// "Download Season Content": every played match, in posting order, as a GAME
// video followed by a STANDINGS post (the table AS OF that game). Bundled into
// one .zip — one folder per game, named so the posting order is obvious at a
// glance (R01.1, R01.2, … SF.1, FINAL), each holding the video, the standings
// image and ready-to-paste Instagram captions. POSTING_ORDER.txt at the root
// still walks the whole season top-to-bottom.

import { zipSync } from 'fflate'
import type { LeagueState, MatchScore } from '../league/types'
import { fixtureMatch, teamById, computeStandings } from '../league/league'
import { exportMatchMp4 } from '../export/exportMp4'
import { exportStandingsPng } from '../render/standingsCard'
import { matchCaption, standingsCaption } from './captions'
import { matchOfWeekIds } from './matchOfWeek'
import { BRAND } from '../brand'

function orderedPlayed(state: LeagueState) {
  const regular = state.fixtures
    .filter((f) => f.stage === 'regular' && state.results[f.id])
    .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id, undefined, { numeric: true }))
  const playoff = ['sf1', 'sf2', 'final']
    .map((id) => state.fixtures.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => !!f && !!state.results[f.id])
  return [...regular, ...playoff]
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Posting-order folder tags for an ordered fixture list: R01.1, R01.2, …
 * SF.1, SF.2, FINAL. Pure so the naming scheme is unit-testable (the full
 * builder needs WebCodecs and only runs in a browser).
 */
export function folderTags(ordered: Array<{ round: number; stage: string }>): string[] {
  const perRound = new Map<number, number>()
  let sfNo = 0
  return ordered.map((f) => {
    if (f.stage === 'regular') {
      const n = (perRound.get(f.round) ?? 0) + 1
      perRound.set(f.round, n)
      return `R${pad(f.round + 1)}.${n}`
    }
    if (f.stage === 'sf') return `SF.${++sfNo}`
    return 'FINAL'
  })
}

export async function buildSeasonContent(
  state: LeagueState,
  onProgress?: (p: number, label: string) => void,
): Promise<Blob> {
  const ordered = orderedPlayed(state)
  const tags = folderTags(ordered)
  const files: Record<string, Uint8Array> = {}
  const manifest: string[] = []
  const counted: Record<string, MatchScore> = {} // regular results accumulated in posting order
  const total = Math.max(1, ordered.length)
  let postNo = 1
  const text = (s: string) => new TextEncoder().encode(s)

  // Re-sim every match once (cheap) so we can pick the Match of the Week per
  // matchday before exporting, then reuse the same result for the video.
  const results = new Map(ordered.map((f) => [f.id, fixtureMatch(state, f.id)]))
  const motw = matchOfWeekIds(
    ordered.filter((f) => f.stage === 'regular'),
    results,
  )

  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i]
    const sc = state.results[f.id]!
    const h = teamById(state, f.home).identity
    const a = teamById(state, f.away).identity

    // folder tag says exactly where this game sits in the posting order
    const tag = tags[i]
    const isMotw = motw.has(f.id)
    const folder = `${tag} - ${h.abbr} vs ${a.abbr}${isMotw ? ' (MATCH OF THE WEEK)' : ''}`
    onProgress?.(i / total, `${tag} ${h.abbr} v ${a.abbr}`)

    const match = results.get(f.id)!
    const vid = await exportMatchMp4(match, (p) => onProgress?.((i + p) / total, `${tag} ${h.abbr} v ${a.abbr}`))

    let rows
    let label: string
    if (f.stage === 'regular') {
      counted[f.id] = sc
      rows = computeStandings(state, counted)
      label = `After MD${pad(f.round + 1)}`
    } else {
      rows = computeStandings(state)
      label = f.stage === 'final' ? 'Final Table' : 'After the Semis'
    }
    const png = await exportStandingsPng(state, label, rows)

    const gameCaption = (isMotw ? '⭐ MATCH OF THE WEEK\n' : '') + matchCaption(state, f, sc)
    const tableCaption = standingsCaption(state, label, rows)
    files[`${folder}/1-game.mp4`] = new Uint8Array(await vid.arrayBuffer())
    files[`${folder}/2-standings.png`] = new Uint8Array(await png.arrayBuffer())
    files[`${folder}/caption-game.txt`] = text(gameCaption)
    files[`${folder}/caption-standings.txt`] = text(tableCaption)

    manifest.push(`POST ${postNo++} — 🎬 ${folder}/1-game.mp4${isMotw ? '   ⭐ MATCH OF THE WEEK' : ''}`)
    manifest.push(indent(gameCaption))
    manifest.push('')
    manifest.push(`POST ${postNo++} — 📊 ${folder}/2-standings.png`)
    manifest.push(indent(tableCaption))
    manifest.push('\n———\n')
  }

  onProgress?.(1, 'zipping')
  const header =
    `${BRAND} — ${state.name}, Season ${state.season}\n` +
    `Post these top-to-bottom. Each folder = one game: post the video first\n` +
    `(caption-game.txt), then the standings image (caption-standings.txt).\n` +
    `Folder names ARE the posting order: R01.1, R01.2, … SF.1, SF.2, FINAL.\n\n`
  files['POSTING_ORDER.txt'] = text(header + manifest.join('\n'))

  const zipped = zipSync(files, { level: 0 }) // mp4/png already compressed → store, don't recompress
  return new Blob([zipped], { type: 'application/zip' })
}

function indent(s: string): string {
  return s
    .split('\n')
    .map((line) => '    ' + line)
    .join('\n')
}
