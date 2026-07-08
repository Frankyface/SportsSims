// The ESSPN Premier League roster: six hand-authored clubs, each a distinct
// football character (name, colours, playing style, personality). Strength is
// NOT tied to the archetype — every new league draws starting ratings at random,
// so any club can be top or bottom, and ratings then carry over season to season
// with small offseason nudges (see advanceSeason / offseasonAdjust).

import { makeRng, randNormal } from '../sim/prng'
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
    description:
      "The old-money aristocrats. Kingsbridge carry themselves like a club that's won everything and expects to again — marble halls, a cathedral-sized trophy room, and a support that boos anything short of a title. Elegant, entitled, quietly ruthless. The team everyone loves to beat.",
    logo: 'A regal heraldic crest: a royal-navy shield, a gold five-point crown up top, twin laurel branches, a serif "KA" monogram. Minted gold on deep navy — coat-of-arms formality, nothing playful.',
  },
  {
    id: 'COB',
    name: 'Cobalt Bay FC',
    abbr: 'COB',
    city: 'Cobalt Bay',
    nickname: 'The Chrome',
    archetype: 'Nouveau-riche project',
    color: '#00bcd4',
    colorAlt: '#e8f7fb',
    styleTilt: 0.08,
    description:
      'New money, no history, all glamour. An offshore fortune arrived and bought a galaxy of stars overnight. Flashy, front-footed and financially bulletproof — but does all that chrome hide a soft centre? Rivals adore watching them bottle it.',
    logo: 'A sleek lowercase wordmark in electric cyan with a chrome bevel; a stylized bay-wave curve or a cut-diamond motif. Tech-startup slick, a little gaudy — money you can see.',
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
    description:
      'Football as art. Marlowe pass you dizzy — a possession-obsessed academy side of slight, silky technicians who’d rather win 4–3 than 1–0 and physically cannot defend a set-piece. Poetry when it clicks; a horror show when it doesn’t. Purists swoon, pragmatists despair.',
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
    colorAlt: '#9aa7b2',
    styleTilt: -0.09,
    description:
      'Forged in a steel town, Ironhaven are grit incarnate — hard, honest, defensively stubborn, the kind of side that out-works you and nicks it 1–0. No superstars, no nonsense, a packed stand of dockworkers who’d die for the shirt. The neutral’s second team and every striker’s nightmare.',
    logo: 'A rugged industrial crest: crossed hammers or an anvil over a claret shield, riveted steel border, bold slab-serif "IRONHAVEN" banner. Weathered, heavy, blue-collar — sparks optional.',
  },
  {
    id: 'MDN',
    name: 'Meridian FC',
    abbr: 'MDN',
    city: 'Meridian',
    nickname: 'The Nomads',
    archetype: 'Cosmopolitan flair',
    color: '#c2185b',
    colorAlt: '#f5b301',
    styleTilt: 0.05,
    description:
      'A rootless, glamorous cult club stitched together from every corner of the map — mercurial, expressive, impossible to pin down. They play with a swagger neutrals adore and traditionalists can’t stand ("no soul, just showreels"). One week sublime, the next a circus. Football’s beautiful drifters.',
    logo: 'A worldly emblem: a compass rose or stylized globe inside a rose-magenta roundel, thin gold line-work, a sleek monogram "M". Cosmopolitan, jet-set, premium but rootless.',
  },
  {
    id: 'SUN',
    name: 'Sundervale Rovers',
    abbr: 'SUN',
    city: 'Sundervale',
    nickname: 'The Terriers',
    archetype: 'Small-town scrappers',
    color: '#ffb300',
    colorAlt: '#2e7d32',
    styleTilt: 0.02,
    description:
      'A tiny market-town side running on heart, duct tape and a manager who’s basically a wizard. All bite and no fear — they’ll throw a punch at anyone on their day and celebrate a scrappy point like a cup final. Everyone’s favourite scrappers, adopted worldwide by anyone who loves a good underdog story.',
    logo: 'A cheeky homespun badge: a scrappy terrier’s head, an amber-and-green scarf motif, a hand-drawn "ROVERS" ribbon. Retro non-league charm, deliberately rough at the edges. Lovable.',
  },
]

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

export function generateLeague(seedKey: string, count = 6): LeagueTeam[] {
  const rng = makeRng(`league:${seedKey}`)
  const chosen = CLUBS.slice(0, Math.min(count, CLUBS.length))
  return chosen.map((c) => {
    const { description, logo, ...identity } = c
    void description
    void logo
    // Strength is a random draw — NOT tied to the club's archetype.
    const rating = clamp(1500 + randNormal(rng) * 120, 1250, 1780)
    const rd = 70 + rng() * 50
    const vol = 0.05 + rng() * 0.03
    return { identity, glicko: { rating, rd, vol } }
  })
}
