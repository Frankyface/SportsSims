// The Apex Tour — ESSPN's golf competition: eight hand-authored golfers, each a
// distinct character (name, colours, playing style, personality). As with the
// clubs, STRENGTH IS NOT tied to the archetype — every new tour draws starting
// ratings (and clutch temperament) at random, then carries them over season to
// season. The bios are flavour; the scoreboard writes the real story.
//
// Golfer ids are permanent — fandom depends on stable identity, never renumber.

import { makeRng, randNormal } from '../sim/prng'
import type { Glicko } from './glicko2'

/** ESSPN golf competition brand — the Simulated Golf Association. */
export const GOLF_TOUR = {
  id: 'sga',
  name: 'The Simulated Golf Association',
  short: 'SGA',
  tagline: 'ESSPN presents the SGA',
  // Real crest lives at public/logos/sga.png (see render/golfBrand.ts); a drawn
  // shield is the fallback until it's added.
  logo:
    'A dark forest-green shield with a gold double border, a white golf ball on a ' +
    'gold tee with a gold swoosh, a gold flag by the hole, "SGA" in white collegiate ' +
    'block letters, and gold laurel branches at the base.',
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

// NOTE: slot ORDER and each slot's riskTilt are frozen — generateGolfTour
// draws ratings from the stream in list order, so reordering slots or moving
// a tilt would silently change every saved season (golden-guarded).
export const GOLFERS: GolferDef[] = [
  {
    id: 'STL',
    name: 'Vic Steele',
    abbr: 'STL',
    nickname: 'The Metronome',
    archetype: 'Ice-cold machine',
    color: '#3d5a80',
    colorAlt: '#e8edf4',
    riskTilt: -0.08,
    description:
      'Fairway, green, two putts, next tee — Steele plays golf like a man filing a tax return, and it is terrifying. No celebration bigger than a nod. Rivals swear he has never once looked at a leaderboard; the leaderboard, however, is usually looking at him.',
  },
  {
    id: 'ACE',
    name: 'Ace Delgado',
    abbr: 'ACE',
    nickname: 'The Cannon',
    archetype: 'Young bomber',
    color: '#ff7a00',
    colorAlt: '#161616',
    riskTilt: 0.12,
    description:
      'Twenty-one years old and swings like he is trying to hurt the ball. Delgado drives greens, cuts corners nobody else can see, and treats lay-ups as a personal insult. Six birdies and two tee shots in the water is just a Tuesday. Box office.',
  },
  {
    id: 'DUK',
    name: 'Duke Fairbanks',
    abbr: 'DUK',
    nickname: 'The Duke',
    archetype: 'Ageing legend',
    color: '#7b1e3b',
    colorAlt: '#f2e8cf',
    riskTilt: -0.05,
    description:
      'Forty-seven, tweed cap, swing like poured honey. Fairbanks has won everything on the schedule at least once — long enough ago that the kids call him "sir". Every spring the question returns: has The Duke got one more Sunday in him? The gallery has already decided.',
  },
  {
    id: 'CRZ',
    name: 'Reyna Cruz',
    abbr: 'CRZ',
    nickname: 'The Surgeon',
    archetype: 'Clutch putter',
    color: '#0f6f5c',
    colorAlt: '#caa64a',
    riskTilt: -0.04,
    description:
      'From twelve feet and in, Cruz simply does not miss — she walks putts in with the flag still in her hand. Tee to green she is mortal; on the dance floor she is an executioner. The last person on earth you want standing over it with the tournament on the line.',
  },
  {
    id: 'SAN',
    name: 'Theo Santana',
    abbr: 'SAN',
    nickname: 'Heatwave',
    archetype: 'Streaky artist',
    color: '#ffd24a',
    colorAlt: '#4a148c',
    riskTilt: 0.06,
    description:
      'When Santana gets hot the course simply surrenders — five birdies in a row, hat backwards, crowd losing its mind. When he is cold you can hear the seagulls. Nobody on tour has a higher ceiling or a squeakier floor. Appointment viewing either way.',
  },
  {
    id: 'BMT',
    name: 'Grant Beaumont',
    abbr: 'BMT',
    nickname: 'Mr. Sunday',
    archetype: 'The nearly-man',
    color: '#0d3b66',
    colorAlt: '#c0c8d0',
    riskTilt: -0.02,
    description:
      'The nickname started sincere and curdled. Beaumont is beautiful to watch and forever THERE on the final afternoon — top three again, gracious runner-up speech again. The most talented player never to get it done… so far. One Sunday changes everything.',
  },
  {
    id: 'MAL',
    name: 'Birdie Malone',
    abbr: 'MAL',
    nickname: 'The Long Shot',
    archetype: 'Scrappy underdog',
    color: '#2e7d32',
    colorAlt: '#f48fb1',
    riskTilt: 0.02,
    description:
      'Yes, her real name is Birdie, and yes, she makes plenty of them. Shortest hitter on tour, deadliest wedge in the hemisphere — Malone qualified out of nowhere, drives a battered estate car between events and grins the entire way round. The people\'s champion.',
  },
  {
    id: 'DUV',
    name: 'Sterling Duval',
    abbr: 'DUV',
    nickname: 'The Peacock',
    archetype: 'Flamboyant showman',
    color: '#ad1457',
    colorAlt: '#ffffff',
    riskTilt: 0.09,
    description:
      'Silk trousers, a different hat every round, and an allergy to the safe play. Duval goes at every flag God made and twirls the club before the ball lands. Half the tour rolls its eyes; the galleries follow him like a carnival. Never, ever boring.',
  },
]

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/**
 * Starting-rating spread (std, rating points). Kept DELIBERATELY TIGHT so the
 * field starts near-even and any golfer has a real shot at any event — the
 * week-to-week form swing (formSpread) can out-punch the small talent gap.
 * Glicko then does the separating: a golfer on a heater sees their rating climb
 * over the season, so hot streaks still create genuine favourites.
 */
const RATING_SPREAD = 66

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
    const rating = clamp(1500 + randNormal(rng) * RATING_SPREAD, 1330, 1670)
    const rd = 70 + rng() * 50
    const vol = 0.05 + rng() * 0.03
    const clutch = clamp(randNormal(rng) * 0.5, -1, 1)
    return { identity, glicko: { rating, rd, vol }, clutch }
  })
}
