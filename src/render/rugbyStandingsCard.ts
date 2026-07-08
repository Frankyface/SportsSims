// The Bastion Championships standings PNG (1080x1920) — the rugby fork. Same
// shared drawLeagueTable renderer as the soccer card; only the columns
// (P W D L PD BP · PTS), the Bastion branding and the deeper competition red
// differ. Ranked points → points difference (union bonus-point system).

import {
  computeRugbyStandings,
  rugbyTeamById,
  type RugbyLeagueState,
  type RugbyStandingRow,
} from '../league/rugbyLeague'
import { ensureRugbyLogosLoaded, getBastionLogo, getRugbyLogo } from './rugbyLogos'
import { BASTION } from './theme'
import {
  CARD_W,
  CARD_H,
  drawLeagueTable,
  type LeagueTableConfig,
  type TableColumn,
  type TableRow,
} from './leagueTable'

export const RUGBY_CARD_W = CARD_W
export const RUGBY_CARD_H = CARD_H

export const COLUMNS: TableColumn[] = [
  { label: 'P', x: 512, key: 'p' },
  { label: 'W', x: 556, key: 'w' },
  { label: 'D', x: 600, key: 'd' },
  { label: 'L', x: 644, key: 'l' },
  { label: 'PD', x: 706, key: 'pd', signed: true },
  { label: 'BP', x: 756, key: 'bp' },
]

function buildConfig(
  state: RugbyLeagueState,
  roundLabel: string,
  rowsOverride?: RugbyStandingRow[],
): LeagueTableConfig {
  const standings = rowsOverride ?? computeRugbyStandings(state)
  const rows: TableRow[] = standings.map((r) => {
    const t = rugbyTeamById(state, r.teamId).identity
    return {
      teamId: r.teamId,
      name: t.name,
      abbr: t.abbr,
      nickname: t.nickname,
      primary: t.color,
      secondary: t.colorAlt,
      crest: getRugbyLogo(r.teamId) ?? null,
      form: r.form,
      points: r.points,
      values: { p: r.played, w: r.won, d: r.drawn, l: r.lost, pd: r.pd, bp: r.bonus },
    }
  })
  return {
    competition: BASTION,
    competitionName: 'Bastion Championships',
    crestLogo: getBastionLogo() ?? null,
    roundLabel,
    season: state.season,
    rows,
    columns: COLUMNS,
    legendRight: 'PD = Points Diff · BP = Bonus',
    footNote: 'Top 4 qualify for playoffs',
  }
}

export function drawRugbyStandingsCard(
  ctx: CanvasRenderingContext2D,
  state: RugbyLeagueState,
  roundLabel: string,
  rowsOverride?: RugbyStandingRow[],
): void {
  drawLeagueTable(ctx, buildConfig(state, roundLabel, rowsOverride))
}

export async function exportRugbyStandingsPng(
  state: RugbyLeagueState,
  roundLabel: string,
  rowsOverride?: RugbyStandingRow[],
): Promise<Blob> {
  await ensureRugbyLogosLoaded()
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context.')
  drawRugbyStandingsCard(ctx, state, roundLabel, rowsOverride)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png')
  })
}
