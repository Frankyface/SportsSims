// Procedural generation of a fictional league: original team identities plus
// randomized starting Glicko ratings (rating, RD, volatility). The spread of
// starting ratings is what gives every season genuine good and bad teams.

import { makeRng, randNormal } from '../sim/prng'
import type { Glicko } from './glicko2'

export interface TeamIdentity {
  id: string
  name: string
  abbr: string
  city: string
  color: string
  colorAlt: string
  styleTilt: number // -0.12..0.12 ; + = attacking (scores & concedes more), - = defensive/grind
}

export interface LeagueTeam {
  identity: TeamIdentity
  glicko: Glicko
}

const CITIES = [
  'South City', 'Kangaroo Valley', 'Port Aurelia', 'Redstone', 'Kingsbridge', 'Northgate',
  'Silverlake', 'Ironhaven', 'Marlowe', 'Vanport', 'Eastcliff', 'Highmoor',
  'Sundervale', 'Blackwater', 'Fairwind', 'Cobalt Bay',
]
const NICKNAMES = [
  'Cardinals', 'United', 'Rovers', 'Athletic', 'City', 'Wanderers', 'Albion', 'County',
  'Dynamo', 'Rangers', 'Union', 'Galaxy', 'Kings', 'Storm', 'Foxes', 'Mariners',
]
const COLORS = [
  '#c8102e', '#0067b1', '#00843d', '#ffb81c', '#6a1b9a', '#e56a17', '#0d7377', '#b71c1c',
  '#1565c0', '#2e7d32', '#f9a825', '#4527a0', '#00838f', '#d84315', '#37474f', '#ad1457',
]

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/** Seeded Fisher–Yates shuffle of indices 0..n-1. */
function shuffledIndices(n: number, rng: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

function makeAbbr(city: string, used: Set<string>): string {
  const letters = city.replace(/[^A-Za-z]/g, '').toUpperCase()
  let base = letters.slice(0, 3)
  let abbr = base
  let n = 1
  while (used.has(abbr)) {
    abbr = base.slice(0, 2) + String(n)
    n++
  }
  used.add(abbr)
  return abbr
}

/**
 * Generate `count` teams for a league. Starting ratings are drawn from a normal
 * centred on 1500 so a season naturally contains contenders, mid-table, and
 * strugglers. RD and volatility are randomized too, so some teams are steadier
 * and some are wildcards.
 */
export function generateLeague(seedKey: string, count = 10): LeagueTeam[] {
  const rng = makeRng(`league:${seedKey}`)
  const cityOrder = shuffledIndices(CITIES.length, rng)
  const nickOrder = shuffledIndices(NICKNAMES.length, rng)
  const colorOrder = shuffledIndices(COLORS.length, rng)
  const usedAbbr = new Set<string>()

  const teams: LeagueTeam[] = []
  for (let i = 0; i < count; i++) {
    const city = CITIES[cityOrder[i % CITIES.length]]
    const nick = NICKNAMES[nickOrder[i % NICKNAMES.length]]
    const color = COLORS[colorOrder[i % COLORS.length]]

    const rating = clamp(1500 + randNormal(rng) * 160, 1180, 1830)
    const rd = 60 + rng() * 80 // 60..140
    const vol = 0.04 + rng() * 0.05 // 0.04..0.09
    const styleTilt = clamp(randNormal(rng) * 0.06, -0.12, 0.12)

    teams.push({
      identity: {
        id: `T${i}`,
        name: `${city} ${nick}`,
        abbr: makeAbbr(city, usedAbbr),
        city,
        color,
        colorAlt: '#0d1117',
        styleTilt,
      },
      glicko: { rating, rd, vol },
    })
  }
  return teams
}
