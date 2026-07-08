// The Apex Tour calendar: 14 events — ten tournaments and FOUR MAJORS (the
// last of them, the Pinnacle Championship, doubles as the season finale).
// Every event has its own hand-authored course with a distinct environment so
// no two stops on the tour look alike on screen.
//
// Course + event ids are permanent — content archives depend on them.

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
]

/**
 * The season, in playing order. The four majors sit at events 4, 8, 11 and 14
 * — the Pinnacle Championship closes the year as the championship major.
 */
export const GOLF_SCHEDULE: GolfEventDef[] = [
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
  },
]

export function golfCourseById(id: string): GolfCourseDef {
  const c = GOLF_COURSES.find((x) => x.id === id)
  if (!c) throw new Error(`Unknown golf course ${id}`)
  return c
}

export function golfEventByIndex(i: number): GolfEventDef {
  const e = GOLF_SCHEDULE[i]
  if (!e) throw new Error(`No golf event at index ${i}`)
  return e
}
