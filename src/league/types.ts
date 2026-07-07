import type { LeagueTeam } from '../ratings/teams'

export type Stage = 'regular' | 'sf' | 'final'

export interface Fixture {
  id: string
  round: number
  stage: Stage
  home: string // team id
  away: string // team id
}

export interface MatchScore {
  home: number
  away: number
  homeXg: number
  awayXg: number
}

export interface SeasonRecord {
  season: number
  championId: string // playoff winner
  shieldId: string // regular-season table topper
  table: Array<{ teamId: string; points: number; gd: number }>
}

export interface LeagueState {
  id: string
  name: string
  seedKey: string
  season: number
  phase: 'regular' | 'playoffs' | 'done'
  teams: LeagueTeam[]
  fixtures: Fixture[]
  results: Record<string, MatchScore> // fixtureId -> score
  history: SeasonRecord[]
  simVersion: number
}

export interface StandingRow {
  teamId: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
  form: string[] // last 5: 'W' | 'D' | 'L'
}
