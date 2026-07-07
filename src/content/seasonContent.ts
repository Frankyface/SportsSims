// "Download Season Content": every played match, in posting order, as a GAME
// video followed by a STANDINGS post (the table AS OF that game). Bundled into
// one .zip with a POSTING_ORDER.txt telling you exactly what to post, in order.

import { zipSync } from 'fflate'
import type { LeagueState, MatchScore } from '../league/types'
import { fixtureMatch, teamById, computeStandings } from '../league/league'
import { exportMatchMp4 } from '../export/exportMp4'
import { exportStandingsPng } from '../render/standingsCard'
import { matchCaption, standingsCaption } from './captions'
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

export async function buildSeasonContent(
  state: LeagueState,
  onProgress?: (p: number, label: string) => void,
): Promise<Blob> {
  const ordered = orderedPlayed(state)
  const files: Record<string, Uint8Array> = {}
  const manifest: string[] = []
  const counted: Record<string, MatchScore> = {} // regular results accumulated in posting order
  const total = Math.max(1, ordered.length)
  let postNo = 1

  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i]
    const sc = state.results[f.id]!
    const h = teamById(state, f.home).identity
    const a = teamById(state, f.away).identity
    const roundTag = f.stage === 'regular' ? `MD${pad(f.round + 1)}` : f.stage.toUpperCase()
    onProgress?.(i / total, `${roundTag} ${h.abbr} v ${a.abbr}`)

    const match = fixtureMatch(state, f.id)
    const vid = await exportMatchMp4(match, (p) => onProgress?.((i + p) / total, `${roundTag} ${h.abbr} v ${a.abbr}`))

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

    const base = `${pad(i + 1)}_${roundTag}_${h.abbr}-vs-${a.abbr}`
    files[`${base}_1game.mp4`] = new Uint8Array(await vid.arrayBuffer())
    files[`${base}_2standings.png`] = new Uint8Array(await png.arrayBuffer())

    manifest.push(`POST ${postNo++} — 🎬 ${base}_1game.mp4`)
    manifest.push(indent(matchCaption(state, f, sc)))
    manifest.push('')
    manifest.push(`POST ${postNo++} — 📊 ${base}_2standings.png`)
    manifest.push(indent(standingsCaption(state, label, rows)))
    manifest.push('\n———\n')
  }

  onProgress?.(1, 'zipping')
  const header =
    `${BRAND} — ${state.name}, Season ${state.season}\n` +
    `Post these top-to-bottom. Each match = a GAME video, then a STANDINGS post.\n` +
    `Files are numbered in posting order.\n\n`
  files['POSTING_ORDER.txt'] = new TextEncoder().encode(header + manifest.join('\n'))

  const zipped = zipSync(files, { level: 0 }) // mp4/png already compressed → store, don't recompress
  return new Blob([zipped], { type: 'application/zip' })
}

function indent(s: string): string {
  return s
    .split('\n')
    .map((line) => '    ' + line)
    .join('\n')
}
