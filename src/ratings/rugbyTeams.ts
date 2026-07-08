// The Bastion — ESSPN's rugby competition: six hand-authored clubs, each a
// distinct rugby character (name, colours, playing style, personality). As with
// football, STRENGTH IS NOT tied to the archetype — every new league draws
// starting ratings at random, then carries them over season to season.
//
// This is the identity layer only. There is no rugby SIM yet: rugby clubs have
// no crest PNGs, so renderers fall back to a colour-chip badge (drawCrestChip).
// Club ids are permanent — fandom depends on stable identity, never renumber.

import { makeRng, randNormal } from '../sim/prng'
import type { ClubDef, LeagueTeam } from './teams'

/** ESSPN rugby competition brand. Name matches the delivered crest artwork. */
export const RUGBY_LEAGUE = {
  id: 'bastion',
  name: 'Bastion Championships',
  short: 'Bastion',
  tagline: 'ESSPN presents the Bastion Championships',
  // Real crest lives at assets/logos/bastion.png (see render/rugbyLogos.ts):
  // a navy fortress shield with gold ramparts + a rugby ball, silver + gold trim.
  logo: 'Navy fortress-shield crest with gold castle ramparts, a rugby ball and silver/gold trim.',
}

// styleTilt: + = expansive, ball-in-hand running rugby (scores AND concedes more);
//            - = forward-dominant, territory & set-piece grind (tighter, lower-scoring).
export const RUGBY_CLUBS: ClubDef[] = [
  {
    id: 'THB',
    name: 'Thornbury RFC',
    abbr: 'THB',
    city: 'Thornbury',
    nickname: 'The Bulls',
    archetype: 'Set-piece bruisers',
    color: '#14512c',
    colorAlt: '#f2f4f3',
    styleTilt: -0.1,
    description:
      "Win the collision, own the set-piece, squeeze you to death. Thornbury are a monstrous eight who'll maul it forty metres and kick the corners all afternoon — thrilling if you love the dark arts, agony if you don't. The backs mostly stay warm. Nobody enjoys a wet Tuesday at Thornbury.",
    logo:
      'A blunt, powerful crest: a snorting bull\'s head over a forest-green shield, ' +
      'white slab-serif "THORNBURY" banner, a scrum motif. Heavy, agricultural, immovable.',
  },
  {
    id: 'HGH',
    name: 'Highmoor RFC',
    abbr: 'HGH',
    city: 'Highmoor',
    nickname: 'The Stags',
    archetype: 'Establishment blue-bloods',
    color: '#4a148c',
    colorAlt: '#caa64a',
    styleTilt: -0.02,
    description:
      'The blazer-and-tie aristocracy of the game — generational money, a pristine lineout and a goal-kicker with a heart rate of forty. Composed to the point of smugness, they close out tight games in their sleep and expect the silverware by default. The club the whole league dreams of toppling.',
    logo:
      'A regal heraldic crest: a gold stag\'s head with full antlers on a royal-purple shield, ' +
      'thin gold line-work, a serif monogram "H". Old-money, immaculate, quietly superior.',
  },
  {
    id: 'SLC',
    name: 'Saltcombe RFC',
    abbr: 'SLC',
    city: 'Saltcombe',
    nickname: 'The Mariners',
    archetype: 'Running-rugby romantics',
    color: '#0d3b66',
    colorAlt: '#34b3e6',
    styleTilt: 0.11,
    description:
      'Champagne rugby by the sea. Saltcombe offload everything, counter from their own in-goal and would rather win 38–33 than 12–9 — box-office when it flows, a defensive horror show when it doesn\'t. Purists adore them, forwards-coaches despair. The neutral\'s favourite watch.',
    logo:
      'A breezy coastal roundel: a ship\'s anchor crossed with a rugby ball, navy and sky-blue ' +
      'wave line-work, an airy open feel. Nautical, elegant, a little reckless.',
  },
  {
    id: 'RVN',
    name: 'Ravensworth RFC',
    abbr: 'RVN',
    city: 'Ravensworth',
    nickname: 'The Colliers',
    archetype: 'Blue-collar line-speed',
    color: '#161616',
    colorAlt: '#ff7a00',
    styleTilt: -0.05,
    description:
      'Pit-town hard men with line-speed off the charts — they fold the gainline in half and tackle you into next week, running on grit and a chip on the shoulder the size of a slag heap. No stars, no frills, a packed terrace of ex-miners who\'d die for the shirt. Every fly-half\'s nightmare.',
    logo:
      'A tough industrial badge: a raven on a crossed pick-axe and rugby ball, coal-black shield ' +
      'with a safety-amber border and rivets. Weathered, blue-collar, defiant.',
  },
  {
    id: 'DNC',
    name: 'Duncarrow RFC',
    abbr: 'DNC',
    city: 'Duncarrow',
    nickname: 'The Highlanders',
    archetype: 'Breakdown menace',
    color: '#0f6f5c',
    colorAlt: '#8e7cc3',
    styleTilt: -0.03,
    description:
      'Forged in horizontal sleet. Duncarrow are breakdown vultures — box-kick, chase, jackal, repeat — disciplined, abrasive and utterly comfortable in a knife-fight at 3–3. Ugly, effective and proud of it; romantics loathe playing them and hate losing to them even more.',
    logo:
      'A weather-beaten highland crest: a thistle and a rugby ball over a dark-teal shield, ' +
      'heather-purple saltire accents, a rugged mountain silhouette. Cold, hardy, unglamorous.',
  },
  {
    id: 'WRN',
    name: 'Wrenshire RFC',
    abbr: 'WRN',
    city: 'Wrenshire',
    nickname: 'The Poachers',
    archetype: 'Giant-killing scavengers',
    color: '#b3123c',
    colorAlt: '#f2e8cf',
    styleTilt: 0.04,
    description:
      'A tiny club that runs on cunning — quick taps, cheeky chips, a scavenger openside who lives offside and somehow never gets pinged. Wrenshire nick it 19–17 against clubs three times their size and celebrate like a cup final. Everyone\'s adopted second team.',
    logo:
      'A cheeky homespun badge: a little wren perched on a rugby ball, crimson shield with a ' +
      'cream ribbon reading "POACHERS", hand-drawn and rough at the edges. Scrappy, lovable.',
  },
]

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/**
 * Build a rated rugby league from a seed. Mirrors generateLeague (football):
 * strength is a random draw — NOT tied to the club's archetype — so any club can
 * top or bottom the table, and ratings then carry over season to season.
 */
export function generateRugbyLeague(seedKey: string, count = 6): LeagueTeam[] {
  const rng = makeRng(`rugby-league:${seedKey}`)
  const chosen = RUGBY_CLUBS.slice(0, Math.min(count, RUGBY_CLUBS.length))
  return chosen.map((c) => {
    const { description, logo, ...identity } = c
    void description
    void logo
    const rating = clamp(1500 + randNormal(rng) * 120, 1250, 1780)
    const rd = 70 + rng() * 50
    const vol = 0.05 + rng() * 0.03
    return { identity, glicko: { rating, rd, vol } }
  })
}
