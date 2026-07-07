// The ESSPN Premier League roster: six hand-authored clubs, each a distinct
// football archetype with its own strength tier, playing style, and personality.
// Starting ratings reflect the archetype (the aristocrats start strong, the
// minnows start weak) with a small seeded jitter, and evolve via Glicko across
// seasons. The higher-RD clubs (minnows, mavericks) are the upset merchants.

import { makeRng } from '../sim/prng'
import type { Glicko } from './glicko2'

export interface TeamIdentity {
  id: string
  name: string
  abbr: string
  city: string
  nickname: string
  archetype: string
  color: string
  colorAlt: string
  styleTilt: number // + attacking (scores & concedes more), - defensive/grind
}

export interface ClubDef extends TeamIdentity {
  baseRating: number
  rd: number
  vol: number
  description: string
  logo: string
}

export interface LeagueTeam {
  identity: TeamIdentity
  glicko: Glicko
}

export const CLUBS: ClubDef[] = [
  {
    id: 'KNG',
    name: 'Kingsbridge Athletic',
    abbr: 'KNG',
    city: 'Kingsbridge',
    nickname: 'The Crowns',
    archetype: 'Old-money aristocrats',
    color: '#1a237e',
    colorAlt: '#d4af37',
    styleTilt: 0.02,
    baseRating: 1720,
    rd: 55,
    vol: 0.045,
    description:
      "The old-money aristocrats. Kingsbridge have won everything and expect to win it again — a marble-halls institution with a trophy room the size of a cathedral and a support that boos anything short of a title. Elegant, entitled, quietly ruthless. The team everyone loves to beat.",
    logo: 'A regal heraldic crest: a royal-navy shield, a gold five-point crown up top, twin laurel branches, and a serif "KA" monogram. Minted gold on deep navy — coat-of-arms formality, nothing playful.',
  },
  {
    id: 'COB',
    name: 'Cobalt Bay FC',
    abbr: 'COB',
    city: 'Cobalt Bay',
    nickname: 'The Chrome',
    archetype: 'Nouveau-riche project',
    color: '#00bcd4',
    colorAlt: '#0b0f14',
    styleTilt: 0.08,
    baseRating: 1660,
    rd: 95,
    vol: 0.08,
    description:
      'New money, no history, all glamour. A mid-table nobody until an offshore fortune arrived and bought a galaxy of stars overnight. Flashy, front-footed and financially bulletproof — but does all that chrome hide a soft centre? Rivals adore watching them bottle it.',
    logo: 'Sleek lowercase wordmark in electric cyan with a chrome bevel; a stylized bay-wave curve or a cut-diamond motif. Tech-startup slick, a little gaudy — money you can see.',
  },
  {
    id: 'MAR',
    name: 'Marlowe City',
    abbr: 'MAR',
    city: 'Marlowe',
    nickname: 'The Artisans',
    archetype: 'Tiki-taka technicians',
    color: '#2196f3',
    colorAlt: '#ffffff',
    styleTilt: 0.09,
    baseRating: 1600,
    rd: 80,
    vol: 0.07,
    description:
      'Football as art. Marlowe pass you dizzy — a possession-obsessed academy side of slight, silky technicians who would rather win 4–3 than 1–0 and physically cannot defend a set-piece. Poetry when it clicks; a horror show when it doesn’t. Purists swoon; pragmatists despair.',
    logo: 'A clean arty roundel: thin sky-blue line-work, a swirling ball or an Art-Deco "M", lots of white space. Elegant, boutique, gallery-poster minimalism.',
  },
  {
    id: 'IRN',
    name: 'Ironhaven United',
    abbr: 'IRN',
    city: 'Ironhaven',
    nickname: 'The Foundry',
    archetype: 'Industrial grinders',
    color: '#7b1e2b',
    colorAlt: '#5b6b78',
    styleTilt: -0.09,
    baseRating: 1520,
    rd: 60,
    vol: 0.05,
    description:
      'Forged in a steel town, Ironhaven are grit incarnate — hard, honest, defensively stubborn, the kind of side that out-works you and nicks it 1–0. No superstars, no nonsense, a packed stand of dockworkers who’d die for the shirt. The neutral’s second team and every striker’s nightmare.',
    logo: 'A rugged industrial crest: crossed hammers or an anvil over a claret shield, riveted steel border, bold slab-serif "IRONHAVEN" banner. Weathered, heavy, blue-collar — sparks optional.',
  },
  {
    id: 'BLK',
    name: 'Blackwater Wanderers',
    abbr: 'BLK',
    city: 'Blackwater',
    nickname: 'The Ghosts',
    archetype: 'Chaos mavericks',
    color: '#6a1b9a',
    colorAlt: '#ff6d00',
    styleTilt: 0.0,
    baseRating: 1470,
    rd: 120,
    vol: 0.095,
    description:
      'Nobody knows what Blackwater will do — least of all Blackwater. A boom-or-bust cult club of mavericks and misfits who look like geniuses and clowns in the same half. Brilliant, baffling, utterly unpredictable. The variance kings; back them at your peril.',
    logo: 'A moody, mystical mark: purple crest with an orange will-o’-the-wisp flame or a wandering-star, gothic "W". Dark, cultish, a touch occult — mysterious and a little unhinged.',
  },
  {
    id: 'SUN',
    name: 'Sundervale Rovers',
    abbr: 'SUN',
    city: 'Sundervale',
    nickname: 'The Terriers',
    archetype: 'Plucky minnows',
    color: '#ffb300',
    colorAlt: '#2e7d32',
    styleTilt: 0.02,
    baseRating: 1380,
    rd: 110,
    vol: 0.09,
    description:
      'The little club that shouldn’t be here. A tiny market-town side running on heart, duct tape and a manager who’s basically a wizard. Everyone’s favourite underdog — they’ll ship five one week and knock off the champions the next. Pure chaos-heart energy, adopted worldwide by anyone who loves a giant-killing.',
    logo: 'A cheeky homespun badge: a scrappy terrier’s head, an amber-and-green scarf motif, a hand-drawn "ROVERS" ribbon. Retro non-league charm, deliberately rough around the edges. Lovable.',
  },
]

export function generateLeague(seedKey: string, count = 6): LeagueTeam[] {
  const rng = makeRng(`league:${seedKey}`)
  const chosen = CLUBS.slice(0, Math.min(count, CLUBS.length))
  return chosen.map((c) => {
    const jitter = (rng() * 2 - 1) * 40 // ±40 Elo of seeded variety season to season
    const { baseRating, rd, vol, description, logo, ...identity } = c
    void description
    void logo
    return {
      identity,
      glicko: { rating: baseRating + jitter, rd, vol },
    }
  })
}
