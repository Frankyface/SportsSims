// The Crown League "second post": a 1080x1920 broadcast-grade league-table PNG.
// A thin adapter over the shared drawLeagueTable renderer (render/leagueTable.ts):
// it maps the soccer LeagueState + standings into the generic table config
// (P W D L GD · PTS · form) and supplies the Crown League branding.

import type { LeagueState, StandingRow } from '../league/types'
import { computeStandings, teamById } from '../league/league'
import { getLogo, getLeagueLogo, ensureLogosLoaded } from './logos'
import { CROWN } from './theme'
import {
  CARD_W,
  CARD_H,
  drawLeagueTable,
  type LeagueTableConfig,
  type TableColumn,
  type TableRow,
} from './leagueTable'

export { CARD_W, CARD_H }

export const COLUMNS: TableColumn[] = [
  { label: 'P', x: 536, key: 'p' },
  { label: 'W', x: 586, key: 'w' },
  { label: 'D', x: 636, key: 'd' },
  { label: 'L', x: 686, key: 'l' },
  { label: 'GD', x: 738, key: 'gd', signed: true },
]

function buildConfig(state: LeagueState, roundLabel: string, rowsOverride?: StandingRow[]): LeagueTableConfig {
  const standings = rowsOverride ?? computeStandings(state)
  const rows: TableRow[] = standings.map((r) => {
    const t = teamById(state, r.teamId).identity
    return {
      teamId: r.teamId,
      name: t.name,
      abbr: t.abbr,
      nickname: t.nickname,
      primary: t.color,
      secondary: t.colorAlt,
      crest: getLogo(r.teamId) ?? null,
      form: r.form,
      points: r.points,
      values: { p: r.played, w: r.won, d: r.drawn, l: r.lost, gd: r.gd },
    }
  })
  return {
    competition: CROWN,
    competitionName: 'Crown League',
    crestLogo: getLeagueLogo() ?? null,
    roundLabel,
    season: state.season,
    rows,
    columns: COLUMNS,
    legendRight: 'GD = Goal Difference',
    footNote: 'Top 4 qualify for playoffs',
  }
}

export function drawStandingsCard(
  ctx: CanvasRenderingContext2D,
  state: LeagueState,
  roundLabel: string,
  rowsOverride?: StandingRow[],
): void {
  drawLeagueTable(ctx, buildConfig(state, roundLabel, rowsOverride))
}

export async function exportStandingsPng(
  state: LeagueState,
  roundLabel: string,
  rowsOverride?: StandingRow[],
): Promise<Blob> {
  await ensureLogosLoaded()
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context for the standings card.')
  drawStandingsCard(ctx, state, roundLabel, rowsOverride)
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  )
}
