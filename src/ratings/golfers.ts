// The Apex Tour — ESSPN's golf competition: eight hand-authored golfers, each a
// distinct character (name, colours, playing style, personality). As with the
// clubs, STRENGTH IS NOT tied to the archetype — every new tour draws starting
// ratings (and clutch temperament) at random, then carries them over season to
// season. The bios are flavour; the scoreboard writes the real story.
//
// Golfer ids are permanent — fandom depends on stable identity, never renumber.

import { makeRng, randNormal } from '../sim/prng'
import type { Glicko } from './glicko2'

/** ESSPN golf competition brand. */
export const GOLF_TOUR = {
  id: 'apex',
  name: 'The Apex Tour',
  short: 'Apex',
  tagline: 'ESSPN presents The Apex Tour',
  logo:
    'A minimal prestige mark: a dark-emerald roundel with a gold mountain-peak ' +
    'apex doubling as a golf flag, thin gold ring, "APEX TOUR" in spaced serif caps.',
}

export interface GolferIdentity {
  id: string
  name: string
  abbr: string // 3 letters for the leaderboard
  nickname: string
  archetype: string
  color: string
  colorAlt: string
  /**
   * + = aggressive, go-for-broke golf (more birdies AND more disasters);
   * - = conservative fairways-and-greens grind (steadier, fewer fireworks).
   * A STYLE, not a strength — mirrors the clubs' styleTilt.
   */
  riskTilt: number
}

export interface GolferDef extends GolferIdentity {
  description: string
}

export interface TourGolfer {
  identity: GolferIdentity
  glicko: Glicko
  /**
   * Pressure response, drawn RANDOMLY at tour creation (NOT from the bio):
   * + thrives on the final-round leaderboard, - tightens up. -1..+1.
   */
  clutch: number
}

export const GOLFERS: GolferDef[] = [
  {
    id: 'CRA',
    name: 'Silas Crane',
    abbr: 'CRA',
    nickname: 'The Metronome',
    archetype: 'Ice-cold machine',
    color: '#3d5a80',
    colorAlt: '#e8edf4',
    riskTilt: -0.08,
    description:
      'Fairway, green, two putts, next tee — Crane plays golf like a man filing a tax return, and it is terrifying. No celebration bigger than a nod. Rivals swear he has never once looked at a leaderboard; the leaderboard, however, is usually looking at him.',
  },
  {
    id: 'CAL',
    name: 'Dex Calloway',
    abbr: 'CAL',
    nickname: 'The Cannon',
    archetype: 'Young bomber',
    color: '#ff7a00',
    colorAlt: '#161616',
    riskTilt: 0.12,
    description:
      'Twenty-one years old and swings like he is trying to hurt the ball. Calloway drives greens, cuts corners nobody else can see, and treats lay-ups as a personal insult. Six birdies and two tee shots in the water is just a Tuesday. Box office.',
  },
  {
    id: 'ASH',
    name: 'Wendell Ashford',
    abbr: 'ASH',
    nickname: 'Old Wick',
    archetype: 'Ageing legend',
    color: '#7b1e3b',
    colorAlt: '#f2e8cf',
    riskTilt: -0.05,
    description:
      'Forty-seven, tweed cap, swing like poured honey. Ashford has won everything on the schedule at least once — long enough ago that the kids call him "sir". Every spring the question returns: has Old Wick got one more Sunday in him? The gallery has already decided.',
  },
  {
    id: 'VEG',
    name: 'Marisol Vega',
    abbr: 'VEG',
    nickname: 'The Surgeon',
    archetype: 'Clutch putter',
    color: '#0f6f5c',
    colorAlt: '#caa64a',
    riskTilt: -0.04,
    description:
      'From twelve feet and in, Vega simply does not miss — she walks putts in with the flag still in her hand. Tee to green she is mortal; on the dance floor she is an executioner. The last person on earth you want standing over it with the tournament on the line.',
  },
  {
    id: 'OKA',
    name: 'Tommy Okafor',
    abbr: 'OKA',
    nickname: 'Heatwave',
    archetype: 'Streaky artist',
    color: '#ffd24a',
    colorAlt: '#4a148c',
    riskTilt: 0.06,
    description:
      'When Okafor gets hot the course simply surrenders — five birdies in a row, hat backwards, crowd losing its mind. When he is cold you can hear the seagulls. Nobody on tour has a higher ceiling or a squeakier floor. Appointment viewing either way.',
  },
  {
    id: 'LIN',
    name: 'Beau Lindqvist',
    abbr: 'LIN',
    nickname: 'Mr. Sunday',
    archetype: 'The nearly-man',
    color: '#0d3b66',
    colorAlt: '#c0c8d0',
    riskTilt: -0.02,
    description:
      'The nickname started sincere and curdled. Lindqvist is beautiful to watch and forever THERE on the final afternoon — top three again, gracious runner-up speech again. The most talented player never to get it done… so far. One Sunday changes everything.',
  },
  {
    id: 'HOL',
    name: 'June Holloway',
    abbr: 'HOL',
    nickname: 'Junebug',
    archetype: 'Scrappy underdog',
    color: '#2e7d32',
    colorAlt: '#f48fb1',
    riskTilt: 0.02,
    description:
      'Shortest hitter on tour, deadliest wedge in the hemisphere. Holloway qualified out of nowhere, drives a battered estate car between events and grins the entire way round. Gets up and down from car parks. The neutral\'s favourite by a country mile.',
  },
  {
    id: 'STC',
    name: 'Rafferty St. Clair',
    abbr: 'STC',
    nickname: 'The Peacock',
    archetype: 'Flamboyant showman',
    color: '#ad1457',
    colorAlt: '#ffffff',
    riskTilt: 0.09,
    description:
      'Silk trousers, a different hat every round, and an allergy to the safe play. St. Clair goes at every flag God made and twirls the club before the ball lands. Half the tour rolls its eyes; the galleries follow him like a carnival. Never, ever boring.',
  },
]

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/**
 * Build a rated tour field from a seed. Mirrors generateLeague (football):
 * skill is a random draw — NOT tied to the golfer's archetype — so any golfer
 * can be world #1 or the tour's whipping post, and ratings then carry over
 * season to season. Clutch temperament is also drawn here, for the same reason.
 */
export function generateGolfTour(seedKey: string, count = 8): TourGolfer[] {
  const rng = makeRng(`golf-tour:${seedKey}`)
  const chosen = GOLFERS.slice(0, Math.min(count, GOLFERS.length))
  return chosen.map((g) => {
    const { description, ...identity } = g
    void description
    const rating = clamp(1500 + randNormal(rng) * 120, 1250, 1780)
    const rd = 70 + rng() * 50
    const vol = 0.05 + rng() * 0.03
    const clutch = clamp(randNormal(rng) * 0.5, -1, 1)
    return { identity, glicko: { rating, rd, vol }, clutch }
  })
}
