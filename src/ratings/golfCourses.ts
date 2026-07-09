// The Apex Tour calendar: 14 events — ten tournaments and FOUR MAJORS (the
// last of them, the Pinnacle Championship, doubles as the season finale).
// Every event has its own hand-authored course with a distinct environment so
// no two stops on the tour look alike on screen.
//
// Course + event ids are permanent — content archives depend on them.

import { makeRng } from '../sim/prng'
import type { GolfCourseDef, GolfHoleDef } from '../sim/golfTypes'

export interface GolfEventDef {
  id: string
  name: string
  short: string // fits the scorebug chip
  courseId: string
  major: boolean
  /** The season-ending major. */
  championship: boolean
  /** Event accent colour for cards/overlays (majors get bespoke branding). */
  color: string
  colorAlt: string
  /** Logo art direction — the operator generates real marks from these. */
  logo: string
  /** Prestige/character write-up (majors carry one, shown in the Majors book). */
  description?: string
}

/** h(par, hazard, difficulty, water) — compact hole author. */
function h(par: 3 | 4 | 5, hazard: number, difficulty: number, water = false): GolfHoleDef {
  return { par, hazard, difficulty, water }
}

function course(id: string, name: string, env: GolfCourseDef['env'], holes: GolfHoleDef[]): GolfCourseDef {
  return { id, name, env, par: holes.reduce((s, x) => s + x.par, 0), holes }
}

export const GOLF_COURSES: GolfCourseDef[] = [
  course('harborlight', 'Harborlight Point', 'coast', [
    h(4, 0.3, -0.2), h(3, 0.5, 0.1, true), h(4, 0.2, -0.3), h(5, 0.4, -0.4, true),
    h(4, 0.3, 0.2), h(3, 0.2, -0.2), h(4, 0.5, 0.3, true), h(5, 0.3, -0.3), h(4, 0.4, 0.4, true),
  ]),
  course('timberline', 'Timberline Ridge', 'alpine', [
    h(4, 0.4, 0.1), h(5, 0.3, -0.4), h(3, 0.3, 0.0), h(4, 0.5, 0.3), h(4, 0.4, 0.2),
    h(3, 0.5, 0.4), h(5, 0.4, -0.2), h(4, 0.3, 0.0), h(4, 0.4, 0.3),
  ]),
  course('mirrorlake', 'Mirror Lake', 'lakeside', [
    h(4, 0.4, -0.1, true), h(3, 0.6, 0.2, true), h(5, 0.4, -0.5), h(4, 0.3, 0.0),
    h(4, 0.5, 0.2, true), h(3, 0.4, 0.0, true), h(4, 0.3, -0.2), h(5, 0.5, -0.1, true), h(4, 0.6, 0.5, true),
  ]),
  course('verdanthollow', 'Verdant Hollow', 'forest', [
    h(4, 0.5, 0.2), h(5, 0.4, -0.3), h(4, 0.4, 0.1), h(3, 0.6, 0.3, true), h(4, 0.5, 0.4),
    h(4, 0.3, -0.1), h(3, 0.5, 0.2), h(5, 0.6, 0.0, true), h(4, 0.5, 0.5),
  ]),
  course('gorsewood', 'Gorsewood Common', 'heath', [
    h(4, 0.4, 0.0), h(3, 0.3, -0.2), h(4, 0.5, 0.2), h(5, 0.3, -0.5), h(4, 0.4, 0.1),
    h(3, 0.4, 0.1), h(5, 0.4, -0.2), h(4, 0.5, 0.3), h(4, 0.3, 0.0),
  ]),
  course('whitesand', 'Whitesand Basin', 'desert', [
    h(4, 0.5, 0.1), h(3, 0.4, 0.0), h(5, 0.4, -0.4), h(4, 0.6, 0.4), h(4, 0.4, 0.0),
    h(5, 0.3, -0.3), h(3, 0.6, 0.3), h(4, 0.5, 0.2), h(4, 0.5, 0.2),
  ]),
  course('riverbend', 'Riverbend Meadows', 'parkland', [
    h(4, 0.3, -0.3, true), h(4, 0.4, 0.0), h(3, 0.3, -0.1), h(5, 0.4, -0.4, true),
    h(4, 0.5, 0.3, true), h(3, 0.4, 0.1), h(4, 0.3, -0.2), h(5, 0.4, -0.2), h(4, 0.5, 0.4, true),
  ]),
  course('saltmarsh', 'Saltmarsh Links', 'links', [
    h(4, 0.5, 0.3), h(3, 0.5, 0.2), h(4, 0.6, 0.4), h(5, 0.4, -0.2), h(4, 0.5, 0.2),
    h(3, 0.6, 0.4), h(4, 0.4, 0.1), h(5, 0.5, 0.0), h(4, 0.6, 0.5),
  ]),
  course('palmshade', 'Palmshade Cay', 'tropical', [
    h(4, 0.4, -0.2, true), h(3, 0.5, 0.1, true), h(5, 0.3, -0.5), h(4, 0.4, 0.0),
    h(3, 0.6, 0.2, true), h(4, 0.4, -0.1), h(5, 0.5, -0.2, true), h(4, 0.3, -0.3), h(4, 0.5, 0.3, true),
  ]),
  course('oldquarry', 'The Old Quarry', 'quarry', [
    h(4, 0.5, 0.2), h(3, 0.6, 0.4), h(4, 0.4, 0.1), h(5, 0.5, -0.1), h(4, 0.6, 0.4),
    h(3, 0.4, 0.0), h(4, 0.5, 0.2), h(5, 0.4, -0.3), h(4, 0.5, 0.3),
  ]),
  course('redrock', 'Redrock Mesa', 'canyon', [
    h(4, 0.6, 0.3), h(3, 0.7, 0.5), h(5, 0.4, -0.2), h(4, 0.5, 0.2), h(4, 0.6, 0.4),
    h(3, 0.5, 0.2), h(4, 0.6, 0.3), h(5, 0.5, -0.1), h(4, 0.7, 0.5),
  ]),
  course('highfell', 'Highfell Moor', 'moor', [
    h(4, 0.4, 0.2), h(4, 0.5, 0.3), h(3, 0.4, 0.1), h(5, 0.4, -0.3), h(4, 0.3, 0.0),
    h(3, 0.5, 0.3), h(4, 0.4, 0.1), h(5, 0.3, -0.2), h(4, 0.5, 0.4),
  ]),
  course('frostpine', 'Frostpine Vale', 'frost', [
    h(4, 0.4, 0.1), h(3, 0.4, 0.2), h(4, 0.5, 0.2), h(5, 0.3, -0.4), h(4, 0.4, 0.0),
    h(4, 0.5, 0.3), h(3, 0.3, -0.1), h(5, 0.4, -0.2), h(4, 0.4, 0.2),
  ]),
  course('pinnacle', 'Pinnacle Head', 'cliffs', [
    h(4, 0.6, 0.3), h(3, 0.7, 0.4, true), h(4, 0.5, 0.2), h(5, 0.5, -0.1, true), h(4, 0.6, 0.4),
    h(3, 0.6, 0.3, true), h(4, 0.5, 0.2), h(5, 0.6, 0.1, true), h(4, 0.7, 0.6, true),
  ]),
  // --- expansion pool: 10 more venues so a season rotates 10 of 20 tournaments ---
  course('sable-dunes-links', 'Sable Dunes Links', 'links', [
    h(4, 0.25, 0.1), h(5, 0.35, 0.3), h(3, 0.5, 0.2), h(4, 0.3, 0.4), h(4, 0.4, 0.6, true),
    h(3, 0.55, -0.1), h(5, 0.4, 0.5), h(4, 0.35, 0.55), h(4, 0.45, 0.7),
  ]),
  course('halcyon-bay', 'Halcyon Bay', 'coast', [
    h(4, 0.3, 0.2, true), h(3, 0.45, 0.1, true), h(4, 0.35, 0.35), h(5, 0.4, 0.25, true), h(4, 0.3, 0.0),
    h(4, 0.45, 0.5, true), h(3, 0.55, 0.3, true), h(5, 0.35, -0.2), h(4, 0.4, 0.55, true),
  ]),
  course('ravenscliff', 'Ravenscliff', 'cliffs', [
    h(4, 0.5, 0.3), h(3, 0.8, 0.5, true), h(4, 0.6, 0.55, true), h(5, 0.55, 0.4), h(4, 0.65, 0.6),
    h(3, 0.85, 0.7, true), h(4, 0.5, 0.35), h(5, 0.6, 0.5, true), h(4, 0.7, 0.8, true),
  ]),
  course('marisol-key', 'Marisol Key', 'tropical', [
    h(4, 0.3, -0.2), h(5, 0.35, -0.4, true), h(3, 0.5, 0.1, true), h(4, 0.4, 0.0, true), h(4, 0.3, -0.3),
    h(3, 0.45, -0.1, true), h(5, 0.4, -0.35, true), h(4, 0.35, 0.2), h(4, 0.45, 0.3, true),
  ]),
  course('willowmere', 'Willowmere', 'lakeside', [
    h(4, 0.3, 0.1), h(4, 0.4, 0.35, true), h(3, 0.55, 0.4, true), h(5, 0.45, 0.2, true), h(4, 0.35, 0.3),
    h(4, 0.4, 0.45, true), h(3, 0.5, 0.15, true), h(5, 0.4, -0.2), h(4, 0.45, 0.5, true),
  ]),
  course('thornwood-deep', 'Thornwood Deep', 'forest', [
    h(4, 0.55, 0.2), h(5, 0.5, 0.1), h(3, 0.65, 0.35), h(4, 0.6, 0.45), h(4, 0.5, 0.15),
    h(4, 0.7, 0.55, true), h(3, 0.6, 0.3), h(5, 0.55, -0.15), h(4, 0.65, 0.5),
  ]),
  course('elmsworth-park', 'Elmsworth Park', 'parkland', [
    h(4, 0.3, -0.1), h(4, 0.35, 0.05, true), h(5, 0.3, -0.2), h(3, 0.45, 0.2, true), h(4, 0.35, 0.1),
    h(4, 0.3, 0.0), h(5, 0.4, 0.15, true), h(3, 0.35, -0.05), h(4, 0.45, 0.3, true),
  ]),
  course('blackmoor-wild', 'Blackmoor Wild', 'moor', [
    h(4, 0.5, 0.4), h(3, 0.55, 0.45), h(5, 0.5, 0.1), h(4, 0.6, 0.55), h(4, 0.45, 0.25, true),
    h(4, 0.5, 0.5), h(3, 0.6, 0.6), h(5, 0.55, 0.2), h(4, 0.55, 0.65, true),
  ]),
  course('vulture-gorge', 'Vulture Gorge', 'canyon', [
    h(4, 0.6, 0.3), h(5, 0.55, 0.1, true), h(3, 0.85, 0.5, true), h(4, 0.7, 0.45), h(4, 0.65, 0.35),
    h(3, 0.8, 0.4), h(5, 0.6, 0.0, true), h(4, 0.75, 0.55), h(4, 0.7, 0.5, true),
  ]),
  course('kestrel-crag', 'Kestrel Crag', 'alpine', [
    h(4, 0.4, 0.05), h(3, 0.5, 0.15, true), h(5, 0.45, -0.15), h(4, 0.45, 0.25), h(4, 0.4, 0.1, true),
    h(3, 0.55, 0.3), h(4, 0.4, 0.2), h(5, 0.5, 0.35, true), h(4, 0.45, 0.3),
  ]),
]

/**
 * Every SGA event — 20 tournaments + 4 majors. A SEASON is 14 events: the 4
 * majors at fixed slots plus 10 tournaments rotated from the pool of 20 (see
 * seasonSchedule), so different seasons visit different venues.
 */
export const GOLF_EVENTS: GolfEventDef[] = [
  {
    id: 'harborlight-cup', name: 'The Harborlight Cup', short: 'HARBORLIGHT', courseId: 'harborlight',
    major: false, championship: false, color: '#2a6f97', colorAlt: '#f4ecd6',
    logo: 'A lighthouse roundel in slate blue and cream: beam sweeping over a golf flag, rope border.',
  },
  {
    id: 'timberline-classic', name: 'The Timberline Classic', short: 'TIMBERLINE', courseId: 'timberline',
    major: false, championship: false, color: '#355e3b', colorAlt: '#d9c9a3',
    logo: 'A woodcut-style badge: snow-capped ridge over pine rows and a flagstick, forest green + timber tan.',
  },
  {
    id: 'mirrorlake-invitational', name: 'The Mirrorlake Invitational', short: 'MIRRORLAKE', courseId: 'mirrorlake',
    major: false, championship: false, color: '#227c9d', colorAlt: '#bfe3e0',
    logo: 'A serene emblem: a flagstick and pin perfectly mirrored in still water, teal on pale aqua.',
  },
  {
    id: 'evergreen-invitational', name: 'The Evergreen Invitational', short: 'EVERGREEN', courseId: 'verdanthollow',
    major: true, championship: false, color: '#1b5e20', colorAlt: '#caa64a',
    logo: 'MAJOR №1 — prestige crest: deep forest-green shield, a gold flagstick rising between two gold evergreens, laurel ring, "EVERGREEN INVITATIONAL" in serif caps. Old-money springtime golf.',
    description:
      "The most coveted invitation in the sport, played each spring beneath towering evergreens on a course that hasn't moved a blade of grass in generations. Old-money membership, hushed galleries, and fairways so deeply green they look black in the shade of the pines. It anoints the patient shot-shaper over the brute — the artist who can work an iron on command and keep ice in his veins on glassy greens that fall away like water.",
  },
  {
    id: 'gorsewood-trophy', name: 'The Gorsewood Trophy', short: 'GORSEWOOD', courseId: 'gorsewood',
    major: false, championship: false, color: '#6a1b9a', colorAlt: '#e0c34c',
    logo: 'A heathland badge: sprigs of purple heather and yellow gorse crossed under a golf ball, plum + gold.',
  },
  {
    id: 'whitesand-challenge', name: 'The Whitesand Challenge', short: 'WHITESAND', courseId: 'whitesand',
    major: false, championship: false, color: '#c2955c', colorAlt: '#f5ead8',
    logo: 'A sun-bleached desert roundel: pale dunes, a lone flag casting a long shadow, bone white + camel.',
  },
  {
    id: 'riverbend-cup', name: 'The Riverbend Cup', short: 'RIVERBEND', courseId: 'riverbend',
    major: false, championship: false, color: '#2e7d32', colorAlt: '#a8d5ba',
    logo: 'A pastoral crest: a winding river ribbon through meadow green, a stone bridge and flagstick.',
  },
  {
    id: 'saltmarsh-open', name: 'The Saltmarsh Open', short: 'SALTMARSH', courseId: 'saltmarsh',
    major: true, championship: false, color: '#0d3b66', colorAlt: '#e3d5b3',
    logo: 'MAJOR №2 — the seaside slam: weathered navy-and-sand roundel, wind-bent dune grass and a storm pennant over a links flag, rope-and-anchor-chain border, "SALTMARSH OPEN" stamped like a harbour mark. The oldest-feeling trophy in golf.',
    description:
      "The oldest and rawest trophy in the game, fought out on a treeless spit of dune, gorse and blowing sand where the wind alone decides who lifts it. There is nowhere to hide: pot bunkers swallow the timid and the weather turns four times before the turn. It crowns the grinder — the flighter of low, boring stingers who can shrug off a cruel bounce and card par while the rest of the field quietly comes apart.",
  },
  {
    id: 'palmshade-classic', name: 'The Palmshade Classic', short: 'PALMSHADE', courseId: 'palmshade',
    major: false, championship: false, color: '#00897b', colorAlt: '#ffcc80',
    logo: 'A breezy island badge: two crossed palms over a turquoise lagoon green, coral sunset ring.',
  },
  {
    id: 'oldquarry-shield', name: 'The Old Quarry Shield', short: 'OLD QUARRY', courseId: 'oldquarry',
    major: false, championship: false, color: '#546e7a', colorAlt: '#ffb300',
    logo: 'An industrial shield: cut-stone terraces and a flagstick in amber on gunmetal grey, chiselled serif type.',
  },
  {
    id: 'redrock-classic', name: 'The Redrock Classic', short: 'REDROCK', courseId: 'redrock',
    major: true, championship: false, color: '#b3541e', colorAlt: '#ffd9a0',
    logo: 'MAJOR №3 — the desert major: a terracotta mesa arch framing a copper sun and a black flagstick, Route-66-Americana lockup, "REDROCK CLASSIC" in heavy western slab type. Heat shimmer prestige.',
    description:
      "Terracotta mesas, heat-shimmer rising off baked fairways, and a swaggering helping of desert Americana. The Redrock runs firm and fast under a merciless sun, hemmed by canyon walls that catch every roar of the gallery and hurl it back. It rewards the fearless — the long, aggressive player who'll flirt with the sandstone edges, hold rock-hard greens, and keep his cool when the mercury and the pressure both climb.",
  },
  {
    id: 'highfell-trophy', name: 'The Highfell Trophy', short: 'HIGHFELL', courseId: 'highfell',
    major: false, championship: false, color: '#4e5d6c', colorAlt: '#b1a296',
    logo: 'A windswept moorland mark: a lone standing stone and flag on a bare fell, mist grey + peat brown.',
  },
  {
    id: 'frostpine-invitational', name: 'The Frostpine Invitational', short: 'FROSTPINE', courseId: 'frostpine',
    major: false, championship: false, color: '#4a6fa5', colorAlt: '#e8f1f8',
    logo: 'A crisp winter badge: frost-tipped pines and a golf flag under a pale sun, ice blue + white.',
  },
  {
    id: 'pinnacle-championship', name: 'The Pinnacle Championship', short: 'PINNACLE', courseId: 'pinnacle',
    major: true, championship: true, color: '#14141a', colorAlt: '#d4af37',
    logo: 'MAJOR №4, THE CHAMPIONSHIP — the crown jewel: black-and-gold crest, a clifftop spire with a gold flag at its peak above crashing surf, twin laurels, "PINNACLE CHAMPIONSHIP" in engraved gold serif. The season ends here.',
    description:
      "The crown jewel and the season finale, staged on storm-battered sea cliffs where the surf hammers the rocks a hundred feet below the closing holes. Everything rides on this week — the money, the rankings, the legacy — under black-and-gold banners and the heaviest pressure the tour can conjure. It belongs to the closer: the champion who can stand on a clifftop tee with the whole year on the line and still flush it dead into the wind.",
  },
  // --- expansion pool: 10 more tournaments (rotated 10-of-20 per season) ---
  {
    id: 'sable-dunes-open', name: 'The Sable Dunes Open', short: 'SABLE DUNES', courseId: 'sable-dunes-links',
    major: false, championship: false, color: '#1f3a5f', colorAlt: '#c9a227',
    logo: 'A weathered pot-bunker rake crossed with a marram-grass frond over a rolling dune ridge, frayed-rope border, gorse-gold on storm navy.',
  },
  {
    id: 'halcyon-bay-classic', name: 'The Halcyon Bay Classic', short: 'HALCYON BAY', courseId: 'halcyon-bay',
    major: false, championship: false, color: '#0e6b73', colorAlt: '#ff6f59',
    logo: 'A cresting wave curling into golf-ball spindrift, lone cormorant gliding above the foam, rope-knot underline, coral on deep teal.',
  },
  {
    id: 'ravenscliff-cup', name: 'The Ravenscliff Cup', short: 'RAVENSCLIFF', courseId: 'ravenscliff',
    major: false, championship: false, color: '#2b2d42', colorAlt: '#e07a1f',
    logo: 'A raven perched on a jagged clifftop flagstick, sheer rock face plunging to surf below, angular shield outline, ember orange on slate.',
  },
  {
    id: 'marisol-sun-classic', name: 'The Marisol Sun Classic', short: 'MARISOL KEY', courseId: 'marisol-key',
    major: false, championship: false, color: '#12b0a0', colorAlt: '#ff4f81',
    logo: 'A hibiscus bloom tucked behind a crossed palm frond and flagstick, turquoise lagoon ripple beneath, radiant sun-disc crest, flamingo pink on aqua.',
  },
  {
    id: 'willowmere-cup', name: 'The Willowmere Cup', short: 'WILLOWMERE', courseId: 'willowmere',
    major: false, championship: false, color: '#2f6b4f', colorAlt: '#8fb8d6',
    logo: 'A willow branch draping over a mirror-still lake reflecting a flagstick, a heron wading the shallows, calm oval water crest, silver-blue on forest green.',
  },
  {
    id: 'thornwood-open', name: 'The Thornwood Open', short: 'THORNWOOD', courseId: 'thornwood-deep',
    major: false, championship: false, color: '#1f3d2b', colorAlt: '#c8a24a',
    logo: 'A black raven perched on crossed pine boughs, ringed by a dark-green roundel with fine gold serif lettering.',
  },
  {
    id: 'elmsworth-trophy', name: 'The Elmsworth Trophy', short: 'ELMSWORTH', courseId: 'elmsworth-park',
    major: false, championship: false, color: '#234b32', colorAlt: '#7b2d3a',
    logo: 'A broad oak in full leaf above a ribboned estate shield, ivory field with burgundy heraldry and a slim gold border.',
  },
  {
    id: 'blackmoor-cup', name: 'The Blackmoor Cup', short: 'BLACKMOOR', courseId: 'blackmoor-wild',
    major: false, championship: false, color: '#3b4650', colorAlt: '#7d5a9c',
    logo: 'A lone curlew in silhouette wheeling over rolling heather, set in a weathered slate roundel with a faint purple wash.',
  },
  {
    id: 'vulture-gorge-championship', name: 'The Vulture Gorge Championship', short: 'VULTURE', courseId: 'vulture-gorge',
    major: false, championship: false, color: '#9c3a1e', colorAlt: '#2b2622',
    logo: 'A vulture with wings outstretched banking above a jagged canyon rim, rust-red silhouette on charcoal with a thin bone-white edge.',
  },
  {
    id: 'kestrel-invitational', name: 'The Kestrel Invitational', short: 'KESTREL', courseId: 'kestrel-crag',
    major: false, championship: false, color: '#274b6b', colorAlt: '#dfe7ec',
    logo: 'A kestrel hovering wings-back above a snow-capped granite peak, ice-blue and silver linework in a clean circular crest.',
  },
]

/** A SEASON runs 14 events: 4 majors at fixed slots + 10 rotating tournaments. */
export const EVENTS_PER_SEASON = 14
/** Majors in playing order; their season-schedule slot positions (0-based). */
export const MAJOR_IDS = ['evergreen-invitational', 'saltmarsh-open', 'redrock-classic', 'pinnacle-championship']
const MAJOR_SLOTS = [3, 7, 10, 13] // events 4, 8, 11, 14 — Pinnacle (championship) last
/** The 20 tournament event ids — the pool a season draws 10 from. */
export const TOURNAMENT_IDS = GOLF_EVENTS.filter((e) => !e.major).map((e) => e.id)

const EVENT_BY_ID = new Map(GOLF_EVENTS.map((e) => [e.id, e]))

export function eventById(id: string): GolfEventDef {
  const e = EVENT_BY_ID.get(id)
  if (!e) throw new Error(`Unknown golf event ${id}`)
  return e
}

/**
 * The ordered list of 14 event ids for a given tour + season: the 4 majors at
 * their fixed slots, and 10 tournaments drawn (seeded shuffle) from the 20-strong
 * pool. Deterministic — same (seedKey, season) → same calendar, so videos replay.
 */
export function seasonSchedule(seedKey: string, season: number): string[] {
  const rng = makeRng(`${seedKey}:sched:s${season}`)
  const pool = [...TOURNAMENT_IDS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  const picked = pool.slice(0, EVENTS_PER_SEASON - MAJOR_IDS.length) // 10
  const sched: string[] = new Array(EVENTS_PER_SEASON)
  MAJOR_SLOTS.forEach((slot, k) => {
    sched[slot] = MAJOR_IDS[k]
  })
  let ti = 0
  for (let i = 0; i < EVENTS_PER_SEASON; i++) {
    if (sched[i] === undefined) sched[i] = picked[ti++]
  }
  return sched
}

/** Resolve a season's event at a schedule position (0..13). */
export function golfEventForSeason(seedKey: string, season: number, eventIndex: number): GolfEventDef {
  const id = seasonSchedule(seedKey, season)[eventIndex]
  if (!id) throw new Error(`No golf event at season ${season} index ${eventIndex}`)
  return eventById(id)
}

/** The 4 majors, in playing order — for the Majors book. */
export function golfMajors(): GolfEventDef[] {
  return MAJOR_IDS.map((id) => eventById(id))
}

export function golfCourseById(id: string): GolfCourseDef {
  const c = GOLF_COURSES.find((x) => x.id === id)
  if (!c) throw new Error(`Unknown golf course ${id}`)
  return c
}
