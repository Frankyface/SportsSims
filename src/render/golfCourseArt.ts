// Procedural golf-hole art — every Apex Tour hole gets a DISTINCT shape.
//
// A GolfHoleLayout is built once per (renderSeed, course, hole): a seeded hole
// ARCHETYPE (dogleg / cape / island / redan / …) drives a shared CUBIC-bezier
// centreline, a VARIABLE-WIDTH filled fairway polygon, an irregular GREEN blob,
// and hazards. holeToScreen() maps the sim's normalized hole coordinates onto
// that geometry, so abstract shot positions always land on the drawn grass.
//
// Pure render-side code — cosmetic randomness only, on its own stream
// (mulberry32 of renderSeed ^ hole). All seeded params AND final vertex arrays
// are computed once in buildHoleLayout(); drawGolfHole() is a pure paint of the
// stored arrays (zero rng/time), so nothing here can perturb the frozen sim
// stream. Design spec: a 3-lens design panel + synthesis (2026-07-08).

import { mulberry32 } from '../sim/prng'
import type { GolfCourseDef, GolfEnv, GolfHoleDef } from '../sim/golfTypes'

export interface GolfPalette {
  sky: string
  horizon: string // silhouette band colour
  rough: string // out-of-play base
  fairway: string
  green: string
  fringe: string
  sand: string
  water: string
  deco: string // primary decoration colour
  decoAlt: string
}

type DecoKind =
  | 'pine' | 'tree' | 'palm' | 'cactus' | 'rock' | 'heather' | 'dunegrass' | 'reed' | 'stone' | 'frostpine'
  | 'bigtree'

/** A larger, theme-defining "signature" element placed a few times per hole in
 * addition to the ground scatter — this is what makes a theme feel alive. */
const SIGNATURE: Partial<Record<GolfEnv, { kind: DecoKind; count: number; scale: number }>> = {
  forest: { kind: 'bigtree', count: 6, scale: 2.7 },
  parkland: { kind: 'bigtree', count: 3, scale: 2.0 },
}

const PALETTES: Record<GolfEnv, GolfPalette & { deco1: DecoKind; deco2: DecoKind }> = {
  coast: { sky: '#bfe0ee', horizon: '#2a6f97', rough: '#4e8f5c', fairway: '#6fbf73', green: '#8fdf8f', fringe: '#5da963', sand: '#e8d8a8', water: '#2a6f97', deco: '#3c7350', decoAlt: '#d8c890', deco1: 'dunegrass', deco2: 'rock' },
  alpine: { sky: '#cfe4f4', horizon: '#7c8fa3', rough: '#33582f', fairway: '#5a9a52', green: '#7fc46f', fringe: '#4a8444', sand: '#ddcf9e', water: '#3a7ca5', deco: '#1e4d2b', decoAlt: '#8ea4b5', deco1: 'pine', deco2: 'rock' },
  lakeside: { sky: '#cde9f0', horizon: '#227c9d', rough: '#3f7d46', fairway: '#66b564', green: '#8bd98a', fringe: '#56a057', sand: '#e6d6a5', water: '#2f8bad', deco: '#2f6636', decoAlt: '#7cb8a4', deco1: 'reed', deco2: 'tree' },
  forest: { sky: '#b9d7bc', horizon: '#173f22', rough: '#274f2c', fairway: '#4c8f4a', green: '#72bd68', fringe: '#3d7a3d', sand: '#dccf9d', water: '#2d6e8f', deco: '#16351c', decoAlt: '#245a2c', deco1: 'tree', deco2: 'pine' },
  heath: { sky: '#d9d3c0', horizon: '#6a5b4a', rough: '#6d6b3a', fairway: '#8fa04e', green: '#a9c46a', fringe: '#7d8c44', sand: '#e3d3a2', water: '#3a7ca5', deco: '#6a1b9a', decoAlt: '#c9a34c', deco1: 'heather', deco2: 'dunegrass' },
  desert: { sky: '#f4e0bd', horizon: '#b3541e', rough: '#d9b98a', fairway: '#8a9a4e', green: '#9fbf62', fringe: '#7a8a44', sand: '#f0e0b8', water: '#3a7ca5', deco: '#4e7a3a', decoAlt: '#a3552e', deco1: 'cactus', deco2: 'rock' },
  parkland: { sky: '#cfe8cf', horizon: '#3a6b3f', rough: '#437a45', fairway: '#69b566', green: '#8eda8c', fringe: '#59a058', sand: '#e6d6a5', water: '#357f9f', deco: '#2e5e33', decoAlt: '#87b878', deco1: 'tree', deco2: 'reed' },
  links: { sky: '#d8e4e8', horizon: '#4a6f8a', rough: '#b5a86a', fairway: '#8faf62', green: '#a9cc78', fringe: '#7f9c54', sand: '#eadfae', water: '#39698c', deco: '#9a8c58', decoAlt: '#6f8f5c', deco1: 'dunegrass', deco2: 'rock' },
  tropical: { sky: '#c8ecec', horizon: '#00897b', rough: '#2f8a52', fairway: '#5cc26c', green: '#84e78e', fringe: '#4cad5c', sand: '#f4e6bc', water: '#20b2aa', deco: '#1d6b41', decoAlt: '#e0a54c', deco1: 'palm', deco2: 'reed' },
  quarry: { sky: '#d5d9dc', horizon: '#546e7a', rough: '#6e7a72', fairway: '#7fa05a', green: '#9cc46e', fringe: '#6f8c4e', sand: '#d9c99a', water: '#3a7ca5', deco: '#4e5d66', decoAlt: '#ffb300', deco1: 'stone', deco2: 'rock' },
  canyon: { sky: '#f2d9b8', horizon: '#8a3d1a', rough: '#c08552', fairway: '#7f954a', green: '#98ba5e', fringe: '#6f8340', sand: '#ecd9a8', water: '#3a7ca5', deco: '#a3552e', decoAlt: '#5a7a3c', deco1: 'rock', deco2: 'cactus' },
  moor: { sky: '#ccd2d4', horizon: '#4e5d6c', rough: '#5d6b4e', fairway: '#7d9455', green: '#9cba6c', fringe: '#6d8449', sand: '#dccfa2', water: '#3a6f8a', deco: '#4a4a48', decoAlt: '#7d6b5a', deco1: 'stone', deco2: 'heather' },
  frost: { sky: '#e4edf4', horizon: '#4a6fa5', rough: '#7e9a7c', fairway: '#9ab890', green: '#b4d4a6', fringe: '#8aa882', sand: '#e8e0c2', water: '#5a8fb5', deco: '#3f6248', decoAlt: '#dfe9ee', deco1: 'frostpine', deco2: 'rock' },
  cliffs: { sky: '#c9dbe6', horizon: '#22384a', rough: '#3c7350', fairway: '#5fae66', green: '#83d484', fringe: '#4f9857', sand: '#e6d6a5', water: '#1d4e6b', deco: '#2c5940', decoAlt: '#8ba3b5', deco1: 'rock', deco2: 'dunegrass' },
}

export function golfPalette(env: GolfEnv): GolfPalette & { deco1: DecoKind; deco2: DecoKind } {
  return PALETTES[env]
}

/** The screen region the hole art fills (below the scorebug, above the plate). */
export const GOLF_ART = { x: 0, y: 292, w: 1080, h: 1330 }

// The leaderboard rail sits top-right; keep hole art out from under it.
const RAIL = { x: 786, y0: 318, y1: 662 }

// --- contract constants (see golfSim: fairway lie clamps lx to ±0.40) --------
const CORRIDOR = 250 // sim lx = ±1 → ±CORRIDOR px (holeToScreen)
const FAIRWAY_BAND = 0.4 // fairway-lie |lx| ceiling in the sim
const W_MIN = FAIRWAY_BAND * CORRIDOR + 12 // 112px horizontal coverage at landing zones
const W_NECK = 96 // narrowest horizontal half-extent off the landing zones
const W_MAX = 192
const STATIONS = 28

// ---------- geometry helpers ------------------------------------------------

type Pt = [number, number]
const TAU = Math.PI * 2

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
}
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
/** Compact raised-cosine bump: 1 at c, 0 outside [c-h, c+h]. No tails. */
function raisedCos(t: number, c: number, h: number): number {
  const d = Math.abs(t - c)
  return d < h ? 0.5 * (1 + Math.cos((Math.PI * (t - c)) / h)) : 0
}
function pointInPoly(pt: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    const hit = yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

// ---------- the shared cubic centreline (LOAD-BEARING) ----------------------

/** Evaluate the fairway centreline at parameter t∈[0,1]. Shared by the polygon
 * builder, holeToScreen, and every hazard/deco placement — the single source
 * of truth that keeps drawn art and sim coordinates aligned. */
function pointOnPath(l: GolfHoleLayout, t: number): Pt {
  const u = 1 - t
  const b0 = u * u * u
  const b1 = 3 * u * u * t
  const b2 = 3 * u * t * t
  const b3 = t * t * t
  return [
    b0 * l.tee[0] + b1 * l.ctrl1[0] + b2 * l.ctrl2[0] + b3 * l.greenC[0],
    b0 * l.tee[1] + b1 * l.ctrl1[1] + b2 * l.ctrl2[1] + b3 * l.greenC[1],
  ]
}
/** Unit tangent of the cubic at t (for the fairway normal + hazard offsets). */
function pathTangent(l: GolfHoleLayout, t: number): Pt {
  const u = 1 - t
  const dx =
    3 * u * u * (l.ctrl1[0] - l.tee[0]) + 6 * u * t * (l.ctrl2[0] - l.ctrl1[0]) + 3 * t * t * (l.greenC[0] - l.ctrl2[0])
  const dy =
    3 * u * u * (l.ctrl1[1] - l.tee[1]) + 6 * u * t * (l.ctrl2[1] - l.ctrl1[1]) + 3 * t * t * (l.greenC[1] - l.ctrl2[1])
  const m = Math.hypot(dx, dy) || 1
  return [dx / m, dy / m]
}

/** Map sim hole coords (x lateral -1..1, y 0 tee..1 pin) to screen px. */
export function holeToScreen(l: GolfHoleLayout, pos: Pt): Pt {
  const [lx, ly] = pos
  if (ly >= 0.955) {
    // On/around the green: place relative to the pin by the sim's green units.
    const d = (1 - ly) / 0.08 // 0..~0.55 green units
    return [l.pin[0] + lx * l.greenR * 1.5, l.pin[1] + d * l.greenR * 1.55]
  }
  const [cx, cy] = pointOnPath(l, ly)
  return [cx + lx * l.corridor, cy]
}

// ---------- fairway width profile -------------------------------------------

interface EdgeWobble {
  A: number[]
  f: number[]
  phi: number[]
}
interface Bump {
  c: number
  halfW: number
  amp: number
  side: -1 | 0 | 1 // 0 both edges, +1 the +normal edge, -1 the −normal edge
}
interface WidthProfile {
  base: number
  bumps: Bump[]
  skewA: number // constant offset on the +normal edge
  skewB: number // constant offset on the −normal edge
  teeRamp: number
  approachTaper: number | null
  wobbleA: EdgeWobble
  wobbleB: EdgeWobble
}

function wobble(w: EdgeWobble, t: number): number {
  let s = 0
  for (let k = 0; k < w.A.length; k++) s += w.A[k] * Math.sin(TAU * w.f[k] * t + w.phi[k])
  return s
}

/** Raw half-width on one edge (side +1 = +normal, -1 = −normal) before the
 * coverage clamp. Tee apron + optional forced-carry approach taper applied. */
function halfWidthSide(p: WidthProfile, t: number, side: 1 | -1): number {
  let w = p.base
  for (const b of p.bumps) {
    if (b.side === 0 || b.side === side) w += b.amp * raisedCos(t, b.c, b.halfW)
  }
  // tee apron: narrow stalk near the tee, ramping to full width by teeRamp
  const apron = smoothstep(0, p.teeRamp, t)
  w = 50 + (w - 50) * apron
  w += side === 1 ? p.skewA : p.skewB
  w += wobble(side === 1 ? p.wobbleA : p.wobbleB, t)
  if (p.approachTaper != null && t > p.approachTaper) {
    w *= 1 - smoothstep(p.approachTaper, Math.min(1, p.approachTaper + 0.14), t)
  }
  return Math.max(6, w)
}

function makeWobble(rng: () => number): EdgeWobble {
  return {
    A: [6 + rng() * 6, 4 + rng() * 4, 3 + rng() * 3],
    f: [1, 2, 3],
    phi: [rng() * TAU, rng() * TAU, rng() * TAU],
  }
}

// ---------- hole archetypes -------------------------------------------------

export type ArchetypeId =
  | 'hourglass' | 'dogleg' | 'elbow' | 'cape' | 'doubleS'
  | 'trumpet' | 'island' | 'redan' | 'biarritz' | 'punchbowl'

interface GreenParams {
  R: number
  ax: number
  ay: number
  phi: number
  amps: [number, number, number]
  concave: number // 0..0.35 of R, kidney dent depth
  concaveDir: number // radians
}
interface ArchetypeConfig {
  id: ArchetypeId
  ctrl1: Pt
  ctrl2: Pt
  greenC: Pt
  profile: WidthProfile
  green: GreenParams
  rings: number // extra concentric green rings (punchbowl)
  tiers: number // 0/1/2 tier/swale chords
  moat: { r: number; side: -1 | 0 | 1 } | null
  hazard: 'pair' | 'knee' | 'ring' | 'redanFront' | 'flank' | 'greenside' | 'stagger' | 'stalk'
}

const DecoInside = 60 // deco keep-out margin beyond the fairway edge

interface Deco {
  x: number
  y: number
  s: number
  kind: DecoKind
}

export interface GolfHoleLayout {
  hole: GolfHoleDef
  env: GolfEnv
  archetype: ArchetypeId
  tee: Pt
  greenC: Pt
  greenR: number // MEAN mapping radius (contract) — may be shrunk by the envelope guard
  pin: Pt
  ctrl1: Pt
  ctrl2: Pt
  corridor: number
  waterSide: -1 | 1
  fairwayPoly: Pt[]
  fairwayCore: Pt[]
  mowStripes: Array<{ a: Pt; b: Pt }>
  green: Pt[]
  fringe: Pt[]
  greenRings: Pt[][]
  greenTiers: Array<{ a: Pt; b: Pt }>
  moat: { cx: number; cy: number; r: number; side: -1 | 0 | 1 } | null
  bunkers: Array<{ x: number; y: number; rx: number; ry: number; rot: number; overGreen: boolean }>
  water: { x: number; y: number; rx: number; ry: number } | null
  seaEdge: boolean
  decos: Deco[]
}

// The island green is a SIGNATURE — it appears on exactly ONE course + hole,
// Mirror Lake's par-3 over the water, and nowhere else on the whole tour.
const ISLAND_COURSE = 'mirrorlake'
const ISLAND_HOLE = 5 // 0-based

/** Pick this hole's archetype from an eligibility set (deterministic draw).
 * 'island' is intentionally absent from every pool — it is force-set on the one
 * signature hole in buildHoleLayout so it stays special. */
function drawArchetype(rng: () => number, par: number, water: boolean, hazard: number): ArchetypeId {
  let pool: ArchetypeId[]
  if (par === 3) {
    pool = ['redan', 'biarritz', 'punchbowl']
  } else if (par === 5) {
    pool = ['hourglass', 'dogleg', 'elbow', 'doubleS']
    if (water || hazard >= 0.4) pool.push('cape')
  } else {
    pool = ['hourglass', 'dogleg', 'elbow', 'trumpet', 'punchbowl']
    if (water || hazard >= 0.4) pool.push('cape')
  }
  return pool[Math.floor(rng() * pool.length)]
}

/** The archetype selection for a hole (own throwaway rng) — used to de-dupe
 * against the neighbouring hole without disturbing the build stream. */
function peekArchetype(course: GolfCourseDef, holeIdx: number, renderSeed: number): ArchetypeId | null {
  if (holeIdx < 0 || holeIdx >= course.holes.length) return null
  const rng = mulberry32((renderSeed ^ Math.imul(holeIdx + 1, 0x9e3779b9)) >>> 0)
  const h = course.holes[holeIdx]
  return drawArchetype(rng, h.par, h.water, h.hazard)
}

// ---------- build the layout ------------------------------------------------

/** Build the seeded, fully-computed layout for one hole of a course. */
export function buildHoleLayout(course: GolfCourseDef, holeIdx: number, renderSeed: number): GolfHoleLayout {
  const rng = mulberry32((renderSeed ^ Math.imul(holeIdx + 1, 0x9e3779b9)) >>> 0)
  const hole = course.holes[holeIdx]

  // archetype selection (first draw), de-duped against the previous hole
  let archetype = drawArchetype(rng, hole.par, hole.water, hole.hazard)
  const prev = peekArchetype(course, holeIdx - 1, renderSeed)
  if (prev && prev === archetype) archetype = drawArchetype(rng, hole.par, hole.water, hole.hazard)
  // the one signature island hole overrides everything
  if (course.id === ISLAND_COURSE && holeIdx === ISLAND_HOLE) archetype = 'island'

  // dogleg / spine direction alternates hole-to-hole (deterministic)
  const seedBit = (renderSeed >>> (holeIdx % 24)) & 1
  const bendSign: -1 | 1 = (holeIdx + seedBit) % 2 === 0 ? 1 : -1

  // baseline tee + green anchors (kept left of the leaderboard rail)
  const cxC = GOLF_ART.x + GOLF_ART.w / 2 - 70
  const teeX = cxC + (rng() * 2 - 1) * 110
  const tee: Pt = [teeX, GOLF_ART.y + GOLF_ART.h - 130]
  const greenY = GOLF_ART.y + 216 + rng() * 70
  const greenX0 = cxC + (rng() * 2 - 1) * 90
  const waterSide: -1 | 1 = hole.water ? bendSign : rng() < 0.5 ? -1 : 1

  const cfg = configureArchetype(archetype, rng, bendSign, tee, [greenX0, greenY], hole)

  // Clamp the green anchor: (x) clear the leaderboard rail, and (y) push tall
  // greens far enough DOWN that the blob's top stays below the horizon band —
  // otherwise a tall/rotated green (Biarritz, Redan) pastes over the sky.
  // Vertical extent is rotation-aware (a rotated wide green reaches up via ax),
  // times the harmonic cap (1.22) and the fringe scale ((R+16)/R).
  const rotUp = Math.abs(Math.sin(cfg.green.phi)) * cfg.green.ax + Math.abs(Math.cos(cfg.green.phi)) * cfg.green.ay
  const blobUp = 1.24 * rotUp * (cfg.green.R + 16) + 6
  const minGreenY = GOLF_ART.y + 118 + 24 + blobUp
  let greenC: Pt = [clamp(cfg.greenC[0], 340, 620), Math.max(cfg.greenC[1], minGreenY)]
  if (greenC[1] > RAIL.y0 - 40 && greenC[1] < RAIL.y1) {
    greenC = [Math.min(greenC[0], RAIL.x - cfg.green.R * 1.5 - 12), greenC[1]]
  }

  const layout: GolfHoleLayout = {
    hole,
    env: course.env,
    archetype,
    tee,
    greenC,
    greenR: cfg.green.R,
    pin: [greenC[0], greenC[1]], // finalised below
    ctrl1: cfg.ctrl1,
    ctrl2: cfg.ctrl2,
    corridor: CORRIDOR,
    waterSide,
    fairwayPoly: [],
    fairwayCore: [],
    mowStripes: [],
    green: [],
    fringe: [],
    greenRings: [],
    greenTiers: [],
    moat: null,
    bunkers: [],
    water: null,
    seaEdge: course.env === 'coast' || course.env === 'links' || course.env === 'cliffs',
    decos: [],
  }

  buildFairway(layout, cfg, hole)
  buildGreen(layout, cfg, rng)
  placeHazards(layout, cfg, rng, hole)
  placeWater(layout, cfg, rng, hole)
  placeDecos(layout, cfg, rng)
  railClamp(layout)

  // NaN guard: if anything degenerated, fall back to a plain straight hole.
  if (layout.fairwayPoly.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
    return straightFallback(course, tee, greenC, hole)
  }
  return layout
}

/** Per-archetype spine + width profile + green + hazard signature. */
function configureArchetype(id: ArchetypeId, rng: () => number, s: -1 | 1, tee: Pt, greenC0: Pt, hole: GolfHoleDef): ArchetypeConfig {
  const L = (a: number): Pt => lerpPt(tee, greenC0, a)
  const yj = (): number => (rng() * 2 - 1) * 40 // small along-path jitter
  const wob = (): [EdgeWobble, EdgeWobble] => [makeWobble(rng), makeWobble(rng)]
  const baseGreenR = hole.par === 3 ? 96 : 88
  const par5 = hole.par === 5

  // straight-cubic default; archetypes override the lateral control offsets
  let c1: Pt = [L(0.34)[0], L(0.34)[1] + yj()]
  let c2: Pt = [L(0.66)[0], L(0.66)[1] + yj()]
  let greenC: Pt = [...greenC0]
  const [wa, wb] = wob()
  let profile: WidthProfile = {
    base: 112, bumps: [], skewA: 0, skewB: 0, teeRamp: 0.16, approachTaper: null, wobbleA: wa, wobbleB: wb,
  }
  let green: GreenParams = { R: baseGreenR, ax: 1, ay: 0.86, phi: 0, amps: [0.1, 0.06, 0.04], concave: 0, concaveDir: 0 }
  let rings = 0
  let tiers = 0
  let moat: ArchetypeConfig['moat'] = null
  let hazard: ArchetypeConfig['hazard'] = 'greenside'

  switch (id) {
    case 'hourglass': {
      const j = (rng() * 2 - 1) * 14
      c1 = [L(0.34)[0] + j, c1[1]]
      c2 = [L(0.66)[0] + j, c2[1]]
      const neckC = par5 ? 0.62 : 0.58
      profile = {
        base: 116,
        bumps: [
          { c: 0.32, halfW: 0.15, amp: 34, side: 0 },
          { c: 0.9, halfW: 0.1, amp: 20, side: 0 },
          { c: neckC, halfW: 0.11, amp: -54, side: 0 },
        ],
        skewA: 0, skewB: 0, teeRamp: 0.15, approachTaper: null, wobbleA: wa, wobbleB: wb,
      }
      green = { R: baseGreenR, ax: 1, ay: 0.86, phi: 0, amps: [0.1, 0.06, 0.04], concave: 0, concaveDir: 0 }
      hazard = 'pair'
      break
    }
    case 'dogleg': {
      c1 = [L(0.34)[0] + s * 55, c1[1]]
      c2 = [L(0.62)[0] + s * 150, c2[1]]
      greenC = [greenC0[0] + s * 40, greenC0[1]]
      profile = {
        base: 108,
        bumps: [
          { c: 0.55, halfW: 0.16, amp: -26, side: (s === 1 ? 1 : -1) as 1 | -1 },
          { c: 0.9, halfW: 0.1, amp: 16, side: 0 },
        ],
        skewA: s === 1 ? -18 : 18, skewB: s === 1 ? 18 : -18, teeRamp: 0.15, approachTaper: null, wobbleA: wa, wobbleB: wb,
      }
      green = { R: baseGreenR, ax: 1.15, ay: 0.82, phi: -s * 0.35, amps: [0.11, 0.07, 0.04], concave: 0.24, concaveDir: s > 0 ? 0 : Math.PI }
      hazard = 'knee'
      break
    }
    case 'elbow': {
      c1 = [L(0.45)[0] + s * 30, c1[1]]
      c2 = [L(0.6)[0] + s * 205, c2[1]]
      greenC = [greenC0[0] + s * 30, greenC0[1]]
      profile = {
        base: 112,
        bumps: [
          { c: 0.3, halfW: 0.14, amp: 26, side: 0 },
          { c: 0.55, halfW: 0.14, amp: 30, side: 0 }, // WIDEN through the bend
          { c: 0.9, halfW: 0.1, amp: 16, side: 0 },
        ],
        skewA: 0, skewB: 0, teeRamp: 0.15, approachTaper: null, wobbleA: wa, wobbleB: wb,
      }
      green = { R: baseGreenR, ax: 1.1, ay: 0.86, phi: s * 0.4, amps: [0.08, 0.05, 0.03], concave: 0, concaveDir: 0 }
      hazard = 'knee'
      break
    }
    case 'cape': {
      c1 = [L(0.3)[0] + s * 20, c1[1]]
      c2 = [L(0.62)[0] + s * (160 + rng() * 60), c2[1]]
      greenC = [greenC0[0] + s * 34, greenC0[1]]
      profile = {
        base: 106,
        bumps: [
          { c: 0.4, halfW: 0.16, amp: 24, side: (s === 1 ? -1 : 1) as 1 | -1 }, // outside landing bulge
          { c: 0.58, halfW: 0.18, amp: -46, side: (s === 1 ? 1 : -1) as 1 | -1 }, // inside shaved by water
        ],
        skewA: s === 1 ? -14 : 14, skewB: s === 1 ? 14 : -14, teeRamp: 0.15, approachTaper: null, wobbleA: wa, wobbleB: wb,
      }
      green = { R: baseGreenR, ax: 1.24, ay: 0.8, phi: s * 0.35, amps: [0.1, 0.07, 0.04], concave: 0.26, concaveDir: s > 0 ? 0 : Math.PI }
      moat = { r: 1.2, side: (s === 1 ? 1 : -1) as -1 | 1 }
      hazard = 'flank'
      break
    }
    case 'doubleS': {
      c1 = [L(0.33)[0] + s * 150, c1[1]]
      c2 = [L(0.66)[0] - s * 150, c2[1]]
      profile = {
        base: 106,
        bumps: [
          { c: 0.3, halfW: 0.13, amp: 34, side: 0 },
          { c: 0.7, halfW: 0.13, amp: 34, side: 0 },
          { c: 0.5, halfW: 0.1, amp: -42, side: 0 },
          { c: 0.84, halfW: 0.09, amp: -22, side: 0 },
        ],
        skewA: 0, skewB: 0, teeRamp: 0.15, approachTaper: null, wobbleA: wa, wobbleB: wb,
      }
      green = { R: baseGreenR, ax: 1, ay: 0.9, phi: s * 0.15, amps: [0.12, 0.08, 0.04], concave: 0, concaveDir: 0 }
      hazard = 'stagger'
      break
    }
    case 'trumpet': {
      c1 = [L(0.35)[0] + s * 40, c1[1]]
      c2 = [L(0.7)[0] + s * 20, c2[1]]
      profile = {
        base: 150,
        bumps: [
          { c: 0.24, halfW: 0.16, amp: -78, side: 0 }, // narrow tee stalk
        ],
        skewA: 0, skewB: 0, teeRamp: 0.1, approachTaper: null, wobbleA: wa, wobbleB: wb,
      }
      green = { R: baseGreenR * 1.05, ax: 1.4, ay: 0.72, phi: 0, amps: [0.09, 0.06, 0.03], concave: 0, concaveDir: 0 }
      tiers = 1
      hazard = 'stalk'
      break
    }
    case 'island': {
      c1 = [L(0.35)[0] + s * 8, c1[1]]
      c2 = [L(0.68)[0] + s * 8, c2[1]]
      profile = { base: 88, bumps: [], skewA: 0, skewB: 0, teeRamp: 0.14, approachTaper: 0.76, wobbleA: wa, wobbleB: wb }
      green = { R: baseGreenR, ax: 0.98, ay: 0.96, phi: 0, amps: [0.09, 0.05, 0.03], concave: 0, concaveDir: 0 }
      moat = { r: 1.55, side: 0 }
      hazard = 'ring'
      break
    }
    case 'redan': {
      c1 = [L(0.35)[0] + (rng() * 2 - 1) * 8, c1[1]]
      c2 = [L(0.68)[0] + (rng() * 2 - 1) * 8, c2[1]]
      profile = {
        base: 92,
        bumps: [{ c: 0.88, halfW: 0.14, amp: 26, side: 0 }],
        skewA: 0, skewB: 0, teeRamp: 0.14, approachTaper: 0.82, wobbleA: wa, wobbleB: wb,
      }
      green = { R: baseGreenR, ax: 1.35, ay: 0.62, phi: -0.6, amps: [0.07, 0.05, 0.03], concave: 0, concaveDir: 0 }
      tiers = 1
      hazard = 'redanFront'
      break
    }
    case 'biarritz': {
      c1 = [L(0.35)[0], c1[1]]
      c2 = [L(0.68)[0] + s * 10, c2[1]]
      profile = { base: 92, bumps: [{ c: 0.86, halfW: 0.12, amp: 20, side: 0 }], skewA: 0, skewB: 0, teeRamp: 0.14, approachTaper: 0.82, wobbleA: wa, wobbleB: wb }
      green = { R: baseGreenR * 1.2, ax: 0.62, ay: 1.35, phi: 0, amps: [0.06, 0.04, 0.03], concave: 0, concaveDir: 0 }
      tiers = 2
      hazard = 'flank'
      break
    }
    case 'punchbowl': {
      c1 = [L(0.33)[0] + s * 16, c1[1]]
      c2 = [L(0.66)[0] + s * 40, c2[1]]
      profile = {
        base: 100,
        bumps: [
          { c: 0.9, halfW: 0.16, amp: 52, side: 0 }, // wide feeding mouth
          { c: 0.55, halfW: 0.1, amp: -18, side: 0 },
        ],
        skewA: 0, skewB: 0, teeRamp: 0.15, approachTaper: null, wobbleA: wa, wobbleB: wb,
      }
      green = { R: baseGreenR * 0.95, ax: 0.98, ay: 0.95, phi: 0, amps: [0.08, 0.05, 0.03], concave: 0, concaveDir: 0 }
      rings = 2
      hazard = 'ring'
      break
    }
  }
  // normalise the green harmonic amps so min radius stays ≥ 0.78·R (star-convex)
  const sum = green.amps[0] + green.amps[1] + green.amps[2]
  if (sum > 0.22) {
    const k = 0.22 / sum
    green = { ...green, amps: [green.amps[0] * k, green.amps[1] * k, green.amps[2] * k] }
  }
  return { id, ctrl1: c1, ctrl2: c2, greenC, profile, green, rings, tiers, moat, hazard }
}

/** Build the variable-width fairway polygon with landing-zone coverage clamp. */
function buildFairway(l: GolfHoleLayout, cfg: ArchetypeConfig, hole: GolfHoleDef): void {
  const p = cfg.profile
  const par5 = hole.par === 5
  const par3 = hole.par === 3
  const A: Pt[] = []
  const B: Pt[] = []
  const coreA: Pt[] = []
  const coreB: Pt[] = []
  const inLanding = (t: number): boolean => {
    if (par3) return false // par 3s have no fairway lies to protect
    if (t >= 0.2 && t <= 0.5) return true
    if (t >= 0.82 && t <= 0.93) return true
    if (par5 && t >= 0.55 && t <= 0.7) return true
    return false
  }
  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS
    const c = pointOnPath(l, t)
    const tg = pathTangent(l, t)
    const n: Pt = [-tg[1], tg[0]] // left normal
    const nAbsX = Math.max(Math.abs(n[0]), 0.6) // bound so coverage math can't blow up
    let wA = halfWidthSide(p, t, 1)
    let wB = halfWidthSide(p, t, -1)
    if (!par3) {
      const need = inLanding(t) ? W_MIN : W_NECK
      const minW = need / nAbsX
      wA = clamp(Math.max(wA, minW), 6, W_MAX)
      wB = clamp(Math.max(wB, minW), 6, W_MAX)
    } else {
      wA = clamp(wA, 0, W_MAX)
      wB = clamp(wB, 0, W_MAX)
    }
    A.push([c[0] + n[0] * wA, c[1] + n[1] * wA])
    B.push([c[0] - n[0] * wB, c[1] - n[1] * wB])
    coreA.push([c[0] + n[0] * wA * 0.6, c[1] + n[1] * wA * 0.6])
    coreB.push([c[0] - n[0] * wB * 0.6, c[1] - n[1] * wB * 0.6])
  }
  l.fairwayPoly = [...A, ...B.reverse()]
  l.fairwayCore = [...coreA, ...coreB.reverse()]

  // a couple of subtle mow stripes across the fairway core
  for (let k = 0; k < 3; k++) {
    const t = 0.3 + k * 0.22
    const c = pointOnPath(l, t)
    const tg = pathTangent(l, t)
    const n: Pt = [-tg[1], tg[0]]
    const w = 70
    l.mowStripes.push({ a: [c[0] + n[0] * w, c[1] + n[1] * w], b: [c[0] - n[0] * w, c[1] - n[1] * w] })
  }
}

/** Build the irregular green blob + fringe + rings/tiers, with the on-green
 * envelope guard that keeps every 'on-green' sim position on drawn grass. */
function buildGreen(l: GolfHoleLayout, cfg: ArchetypeConfig, rng: () => number): void {
  const g = cfg.green
  const R = g.R
  const [gx, gy] = l.greenC
  const cphi = Math.cos(g.phi)
  const sphi = Math.sin(g.phi)
  const p1 = rng() * TAU
  const p2 = rng() * TAU
  const p3 = rng() * TAU
  const N = 22
  const verts: Pt[] = []
  for (let j = 0; j < N; j++) {
    const th = (TAU * j) / N
    let rr = R * (1 + g.amps[0] * Math.sin(th + p1) + g.amps[1] * Math.sin(2 * th + p2) + g.amps[2] * Math.sin(3 * th + p3))
    if (g.concave > 0) {
      let dth = th - g.concaveDir
      while (dth > Math.PI) dth -= TAU
      while (dth < -Math.PI) dth += TAU
      rr -= g.concave * R * Math.exp(-(dth * dth) / (2 * 0.5 * 0.5))
    }
    rr = Math.max(rr, 0.5 * R)
    const lx = Math.cos(th) * rr * g.ax
    const ly = Math.sin(th) * rr * g.ay
    verts.push([gx + cphi * lx - sphi * ly, gy + sphi * lx + cphi * ly])
  }
  l.green = verts

  // fringe = uniform radial scale about greenC (provably encloses a star-convex blob)
  const fs = (R + 16) / R
  l.fringe = verts.map((v) => [gx + (v[0] - gx) * fs, gy + (v[1] - gy) * fs])

  // punchbowl bullseye rings
  l.greenRings = []
  for (let k = 0; k < cfg.rings; k++) {
    const rs = (R + 16 + k * 18) / R
    l.greenRings.push(verts.map((v) => [gx + (v[0] - gx) * rs, gy + (v[1] - gy) * rs]))
  }

  // pin in green-local space (back-biased), rotated — provably inside
  const pinLat = (rng() * 2 - 1) * 0.26 * R * Math.min(g.ax, g.ay)
  const pinBack = -0.15 * R
  l.pin = [gx + cphi * pinLat - sphi * pinBack, gy + sphi * pinLat + cphi * pinBack]

  // envelope guard: shrink greenR (the MAPPING scale only) until the on-green
  // reachable box is inside the drawn blob. The blob is untouched.
  l.greenR = R
  for (let iter = 0; iter < 10; iter++) {
    if (envelopeInside(l)) break
    l.greenR *= 0.9
    if (l.greenR < 0.4 * R) break
  }

  // tier / swale chords
  l.greenTiers = []
  if (cfg.tiers >= 1) {
    const i0 = Math.floor(rng() * N)
    l.greenTiers.push({ a: verts[i0], b: verts[(i0 + N / 2) % N] })
  }
  if (cfg.tiers >= 2) {
    const i1 = (Math.floor(rng() * N) + 3) % N
    l.greenTiers.push({ a: verts[i1], b: verts[(i1 + N / 2) % N] })
  }

  // moat (island ring / cape one-sided lobe) drawn UNDER the green
  if (cfg.moat) {
    const r = cfg.moat.r * R
    let cx = gx
    let cy = gy
    if (cfg.moat.side !== 0) {
      cx = gx + cfg.moat.side * R * 0.7
    }
    l.moat = { cx, cy, r, side: cfg.moat.side }
  }
}

/** Is the on-green reachable box inside the drawn green blob? */
function envelopeInside(l: GolfHoleLayout): boolean {
  const R = l.greenR
  const hx = 0.68 * R
  const dy = 0.9 * R
  const samples: Pt[] = [
    [l.pin[0] - hx, l.pin[1]],
    [l.pin[0] + hx, l.pin[1]],
    [l.pin[0] - hx, l.pin[1] + dy],
    [l.pin[0] + hx, l.pin[1] + dy],
    [l.pin[0], l.pin[1] + dy],
    [l.pin[0] - hx * 0.6, l.pin[1] + dy * 0.6],
    [l.pin[0] + hx * 0.6, l.pin[1] + dy * 0.6],
  ]
  return samples.every((pt) => pointInPoly(pt, l.green))
}

/** Place bunkers per the archetype's hazard signature. */
function placeHazards(l: GolfHoleLayout, cfg: ArchetypeConfig, rng: () => number, hole: GolfHoleDef): void {
  const s = cfg.greenC[0] >= l.greenC[0] ? 1 : -1
  const R = cfg.green.R
  const nAt = (t: number): { c: Pt; n: Pt } => {
    const c = pointOnPath(l, t)
    const tg = pathTangent(l, t)
    return { c, n: [-tg[1], tg[0]] }
  }
  const fairwayBunker = (t: number, side: number): void => {
    const { c, n } = nAt(t)
    const off = halfWidthSide(cfg.profile, t, side > 0 ? 1 : -1) + 46 + rng() * 20
    l.bunkers.push({ x: c[0] + side * Math.sign(n[0] || 1) * off, y: c[1] + side * n[1] * off, rx: 38 + rng() * 20, ry: 26 + rng() * 12, rot: (rng() * 2 - 1) * 0.5, overGreen: false })
  }
  const greensideBunker = (dir: number, over = false): void => {
    l.bunkers.push({
      x: l.greenC[0] + dir * (R + 30 + rng() * 20),
      y: l.greenC[1] + (rng() * 2 - 1) * R * 0.7,
      rx: 34 + rng() * 18, ry: 24 + rng() * 12, rot: (rng() * 2 - 1) * 0.5, overGreen: over,
    })
  }
  switch (cfg.hazard) {
    case 'pair':
      fairwayBunker(0.58, 1)
      fairwayBunker(0.58, -1)
      greensideBunker(rng() < 0.5 ? -1 : 1)
      break
    case 'knee':
      fairwayBunker(0.5, s)
      fairwayBunker(0.44, s)
      greensideBunker(-s)
      break
    case 'stagger':
      fairwayBunker(0.28, s)
      fairwayBunker(0.68, -s)
      greensideBunker(rng() < 0.5 ? -1 : 1)
      break
    case 'flank':
      greensideBunker(-1)
      greensideBunker(1)
      break
    case 'redanFront':
      // deep gathering bunker eating the front corner, drawn OVER the green edge
      l.bunkers.push({ x: l.greenC[0] - Math.cos(cfg.green.phi) * R * 0.7, y: l.greenC[1] + R * 0.5, rx: 44 + rng() * 12, ry: 28 + rng() * 10, rot: cfg.green.phi, overGreen: true })
      greensideBunker(1)
      break
    case 'ring': {
      const n = 4
      for (let k = 0; k < n; k++) {
        const a = (TAU * k) / n + rng() * 0.3
        l.bunkers.push({ x: l.greenC[0] + Math.cos(a) * (R + 26), y: l.greenC[1] + Math.sin(a) * (R + 26) * 0.8, rx: 22 + rng() * 8, ry: 16 + rng() * 6, rot: a, overGreen: false })
      }
      break
    }
    case 'stalk':
      fairwayBunker(0.24, 1)
      fairwayBunker(0.24, -1)
      greensideBunker(rng() < 0.5 ? -1 : 1)
      break
    case 'greenside':
    default:
      greensideBunker(rng() < 0.5 ? -1 : 1)
      if (hole.hazard > 0.4) fairwayBunker(0.55, rng() < 0.5 ? -1 : 1)
      break
  }
}

/** Inland water body (non sea-edge, non-moat holes). */
function placeWater(l: GolfHoleLayout, cfg: ArchetypeConfig, rng: () => number, hole: GolfHoleDef): void {
  if (!hole.water || l.seaEdge || cfg.moat) return
  const t = 0.55 + rng() * 0.3
  const c = pointOnPath(l, t)
  const tg = pathTangent(l, t)
  const n: Pt = [-tg[1], tg[0]]
  const off = halfWidthSide(cfg.profile, t, l.waterSide > 0 ? 1 : -1) + 150
  l.water = {
    x: c[0] + Math.sign(n[0] || l.waterSide) * l.waterSide * off,
    y: c[1] + n[1] * l.waterSide * off,
    rx: 140 + rng() * 70,
    ry: 180 + rng() * 90,
  }
}

/** Environment decoration: a few large signature elements + a ground scatter,
 * all in the rough outside the fairway + green. */
function placeDecos(l: GolfHoleLayout, cfg: ArchetypeConfig, rng: () => number): void {
  const pal = PALETTES[l.env]
  const sig = SIGNATURE[l.env]
  if (sig) placeScatter(l, cfg, rng, sig.count, () => sig.kind, sig.scale, 0.5, DecoInside + sig.scale * 26)
  placeScatter(l, cfg, rng, 36, () => (rng() < 0.72 ? pal.deco1 : pal.deco2), 1, 0.7, DecoInside)
}

/** Scatter `count` decos in the rough, rejecting anything on grass/hazard/rail. */
function placeScatter(
  l: GolfHoleLayout,
  cfg: ArchetypeConfig,
  rng: () => number,
  count: number,
  kindFn: () => DecoKind,
  baseScale: number,
  sizeVar: number,
  margin: number,
): void {
  for (let i = 0; i < count; i++) {
    const t = rng()
    const c = pointOnPath(l, t)
    const side = rng() < 0.5 ? -1 : 1
    // horizontal spread off the centreline (the hole is drawn mostly vertical);
    // start beyond the widest this edge could be, then reject on-grass/hazard.
    const edge = halfWidthSide(cfg.profile, t, side > 0 ? 1 : -1)
    const x = c[0] + side * (edge + margin + rng() * 220)
    const y = c[1] + (rng() * 2 - 1) * 26
    if (x < GOLF_ART.x + 18 || x > GOLF_ART.x + GOLF_ART.w - 18) continue
    if (y < GOLF_ART.y + 150 || y > GOLF_ART.y + GOLF_ART.h - 40) continue
    const p: Pt = [x, y]
    if (pointInPoly(p, l.fairwayPoly)) continue
    if (pointInPoly(p, l.fringe)) continue
    if (l.moat && Math.hypot(x - l.moat.cx, y - l.moat.cy) < l.moat.r + 10) continue
    if (l.water) {
      const dx = (x - l.water.x) / l.water.rx
      const dy = (y - l.water.y) / l.water.ry
      if (dx * dx + dy * dy < 1.35) continue
    }
    if (x > RAIL.x - 20 && y > RAIL.y0 && y < RAIL.y1) continue
    l.decos.push({ x, y, s: baseScale * (0.7 + rng() * sizeVar), kind: kindFn() })
  }
}

/** Pull any hole-art vertex out from under the leaderboard rail. */
function railClamp(l: GolfHoleLayout): void {
  const fix = (poly: Pt[]): void => {
    for (const v of poly) {
      if (v[1] > RAIL.y0 && v[1] < RAIL.y1 && v[0] > RAIL.x) v[0] = RAIL.x
    }
  }
  fix(l.fairwayPoly)
  fix(l.fairwayCore)
  fix(l.green)
  fix(l.fringe)
  for (const r of l.greenRings) fix(r)
  if (l.moat && l.moat.cy > RAIL.y0 - l.moat.r && l.moat.cy < RAIL.y1 + l.moat.r && l.moat.cx + l.moat.r > RAIL.x) {
    l.moat.cx = RAIL.x - l.moat.r
  }
  for (const b of l.bunkers) {
    if (b.y > RAIL.y0 && b.y < RAIL.y1 && b.x + b.rx > RAIL.x) b.x = RAIL.x - b.rx
  }
}

/** Last-resort plain hole if generation degenerates (never off-map). */
function straightFallback(course: GolfCourseDef, tee: Pt, greenC: Pt, hole: GolfHoleDef): GolfHoleLayout {
  const l: GolfHoleLayout = {
    hole, env: course.env, archetype: 'hourglass', tee, greenC,
    greenR: hole.par === 3 ? 96 : 88, pin: [greenC[0], greenC[1] - 8],
    ctrl1: lerpPt(tee, greenC, 1 / 3), ctrl2: lerpPt(tee, greenC, 2 / 3),
    corridor: CORRIDOR, waterSide: 1,
    fairwayPoly: [], fairwayCore: [], mowStripes: [], green: [], fringe: [], greenRings: [], greenTiers: [],
    moat: null, bunkers: [], water: null,
    seaEdge: course.env === 'coast' || course.env === 'links' || course.env === 'cliffs', decos: [],
  }
  const A: Pt[] = []
  const B: Pt[] = []
  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS
    const c = pointOnPath(l, t)
    const w = 118 * smoothstep(0, 0.15, t)
    A.push([c[0] + w, c[1]])
    B.push([c[0] - w, c[1]])
  }
  l.fairwayPoly = [...A, ...B.reverse()]
  l.fairwayCore = l.fairwayPoly
  const N = 22
  for (let j = 0; j < N; j++) {
    const th = (TAU * j) / N
    l.green.push([greenC[0] + Math.cos(th) * l.greenR, greenC[1] + Math.sin(th) * l.greenR * 0.86])
  }
  l.fringe = l.green.map((v) => [greenC[0] + (v[0] - greenC[0]) * 1.18, greenC[1] + (v[1] - greenC[1]) * 1.18])
  return l
}

// ---------- drawing (pure paint of the cached arrays) -----------------------

type Ctx = CanvasRenderingContext2D

function poly(ctx: Ctx, pts: Pt[]): void {
  if (pts.length === 0) return
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

function drawDeco(ctx: Ctx, d: Deco, pal: GolfPalette): void {
  const s = d.s
  ctx.save()
  ctx.translate(d.x, d.y)
  switch (d.kind) {
    case 'pine':
    case 'frostpine':
      ctx.fillStyle = pal.deco
      ctx.beginPath()
      ctx.moveTo(0, -34 * s)
      ctx.lineTo(13 * s, 6 * s)
      ctx.lineTo(-13 * s, 6 * s)
      ctx.closePath()
      ctx.fill()
      if (d.kind === 'frostpine') {
        ctx.fillStyle = pal.decoAlt
        ctx.beginPath()
        ctx.moveTo(0, -34 * s)
        ctx.lineTo(7 * s, -12 * s)
        ctx.lineTo(-7 * s, -12 * s)
        ctx.closePath()
        ctx.fill()
      }
      break
    case 'tree':
      ctx.fillStyle = pal.deco
      ctx.beginPath()
      ctx.arc(0, -14 * s, 15 * s, 0, TAU)
      ctx.fill()
      ctx.fillStyle = pal.decoAlt
      ctx.beginPath()
      ctx.arc(6 * s, -20 * s, 8 * s, 0, TAU)
      ctx.fill()
      break
    case 'bigtree': {
      // a large layered canopy tree with a trunk + soft cast shadow
      ctx.fillStyle = 'rgba(10,14,20,0.16)'
      ctx.beginPath()
      ctx.ellipse(4 * s, 6 * s, 22 * s, 7 * s, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#5a4632'
      ctx.fillRect(-4 * s, -8 * s, 8 * s, 20 * s)
      ctx.fillStyle = pal.deco
      for (const [ox, oy, r] of [
        [0, -30, 22], [-15, -20, 15], [15, -22, 16], [0, -46, 15], [-8, -38, 13], [9, -40, 12],
      ] as const) {
        ctx.beginPath()
        ctx.arc(ox * s, oy * s, r * s, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = pal.decoAlt
      ctx.beginPath()
      ctx.arc(9 * s, -36 * s, 10 * s, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(-4 * s, -50 * s, 7 * s, 0, TAU)
      ctx.fill()
      break
    }
    case 'palm':
      ctx.strokeStyle = pal.decoAlt
      ctx.lineWidth = 4 * s
      ctx.beginPath()
      ctx.moveTo(0, 4 * s)
      ctx.quadraticCurveTo(4 * s, -14 * s, 8 * s, -24 * s)
      ctx.stroke()
      ctx.strokeStyle = pal.deco
      ctx.lineWidth = 3.4 * s
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.5
        ctx.beginPath()
        ctx.moveTo(8 * s, -24 * s)
        ctx.quadraticCurveTo(8 * s + Math.cos(a) * 16 * s, -24 * s + Math.sin(a) * 10 * s, 8 * s + Math.cos(a) * 24 * s, -24 * s + Math.sin(a) * 18 * s + 6 * s)
        ctx.stroke()
      }
      break
    case 'cactus':
      ctx.strokeStyle = pal.deco
      ctx.lineCap = 'round'
      ctx.lineWidth = 7 * s
      ctx.beginPath()
      ctx.moveTo(0, 4 * s)
      ctx.lineTo(0, -26 * s)
      ctx.moveTo(0, -12 * s)
      ctx.lineTo(-9 * s, -12 * s)
      ctx.lineTo(-9 * s, -22 * s)
      ctx.moveTo(0, -6 * s)
      ctx.lineTo(9 * s, -6 * s)
      ctx.lineTo(9 * s, -16 * s)
      ctx.stroke()
      break
    case 'rock':
      ctx.fillStyle = pal.decoAlt
      ctx.beginPath()
      ctx.moveTo(-12 * s, 4 * s)
      ctx.lineTo(-5 * s, -9 * s)
      ctx.lineTo(6 * s, -7 * s)
      ctx.lineTo(12 * s, 4 * s)
      ctx.closePath()
      ctx.fill()
      break
    case 'stone':
      ctx.fillStyle = pal.deco
      ctx.fillRect(-4 * s, -22 * s, 8 * s, 24 * s)
      break
    case 'heather':
      ctx.fillStyle = pal.deco
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.arc(i * 7 * s, 0, 5 * s, 0, TAU)
        ctx.fill()
      }
      break
    case 'dunegrass':
    case 'reed':
      ctx.strokeStyle = d.kind === 'reed' ? pal.deco : pal.decoAlt
      ctx.lineWidth = 2.4 * s
      ctx.lineCap = 'round'
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.moveTo(i * 4 * s, 2 * s)
        ctx.quadraticCurveTo(i * 8 * s, -8 * s, i * 12 * s, -16 * s)
        ctx.stroke()
      }
      break
  }
  ctx.restore()
}

/** Paint one hole: terrain, hazards, fairway, green, tee, decoration. Pure. */
export function drawGolfHole(ctx: Ctx, l: GolfHoleLayout): void {
  const pal = PALETTES[l.env]
  const A = GOLF_ART

  // base rough + sky/horizon band
  ctx.fillStyle = pal.rough
  ctx.fillRect(A.x, A.y, A.w, A.h)
  ctx.fillStyle = pal.sky
  ctx.fillRect(A.x, A.y, A.w, 118)
  ctx.fillStyle = pal.horizon
  ctx.beginPath()
  ctx.moveTo(A.x, A.y + 118)
  const jag = l.env === 'alpine' || l.env === 'canyon' || l.env === 'quarry' || l.env === 'cliffs'
  for (let i = 0; i <= 10; i++) {
    const x = A.x + (A.w * i) / 10
    const h = jag ? (i % 2 === 0 ? 26 : 74) : 38 + 22 * Math.sin(i * 1.7)
    ctx.lineTo(x, A.y + 118 - h)
  }
  ctx.lineTo(A.x + A.w, A.y + 118)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(10,14,20,0.12)'
  ctx.fillRect(A.x, A.y + 112, A.w, 6)

  // sea strip along the water side for coastal courses
  if (l.seaEdge) {
    const w = 180
    const x = l.waterSide < 0 ? A.x : A.x + A.w - w
    ctx.fillStyle = pal.water
    ctx.fillRect(x, A.y + 118, w, A.h - 118)
    seaShimmer(ctx, x, A.y + 118, w, A.h - 118)
    const bx = l.waterSide < 0 ? A.x + w : A.x + A.w - w
    if (l.env === 'cliffs') {
      drawCliffEdge(ctx, bx, l.waterSide, A.y + 118, A.y + A.h)
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fillRect(l.waterSide < 0 ? x + w - 8 : x, A.y + 118, 8, A.h - 118)
    }
  }

  // hazard water UNDER everything: inland body + moat (island/cape)
  if (l.water) {
    ctx.fillStyle = pal.water
    ctx.beginPath()
    ctx.ellipse(l.water.x, l.water.y, l.water.rx, l.water.ry, 0.4, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 4
    ctx.stroke()
    waterShimmer(ctx, l.water.x, l.water.y, l.water.rx, l.water.ry)
  }
  if (l.moat) {
    // sand collar then water, so the green (drawn later) sits on an island
    ctx.fillStyle = pal.sand
    ctx.beginPath()
    ctx.arc(l.moat.cx, l.moat.cy, l.moat.r + 12, 0, TAU)
    ctx.fill()
    ctx.fillStyle = pal.water
    ctx.beginPath()
    ctx.arc(l.moat.cx, l.moat.cy, l.moat.r, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 4
    ctx.stroke()
    waterShimmer(ctx, l.moat.cx, l.moat.cy, l.moat.r * 0.8, l.moat.r * 0.8)
  }

  // fairway: variable-width filled polygon (nonzero winding) + mow sheen
  if (l.fairwayPoly.length) {
    ctx.fillStyle = pal.fairway
    poly(ctx, l.fairwayPoly)
    ctx.fill('nonzero')
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    poly(ctx, l.fairwayCore)
    ctx.fill('nonzero')
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 6
    for (const st of l.mowStripes) {
      ctx.beginPath()
      ctx.moveTo(st.a[0], st.a[1])
      ctx.lineTo(st.b[0], st.b[1])
      ctx.stroke()
    }
  }

  // fairway bunkers (drawn before the green)
  for (const b of l.bunkers) {
    if (b.overGreen) continue
    drawBunker(ctx, pal, b)
  }

  // fringe + punchbowl rings UNDER the green
  if (l.fringe.length) {
    ctx.fillStyle = pal.fringe
    poly(ctx, l.fringe)
    ctx.fill()
  }
  for (let k = 0; k < l.greenRings.length; k++) {
    ctx.fillStyle = k === l.greenRings.length - 1 ? 'rgba(10,14,20,0.10)' : pal.fringe
    poly(ctx, l.greenRings[k])
    ctx.fill()
  }

  // green blob
  if (l.green.length) {
    ctx.fillStyle = pal.green
    poly(ctx, l.green)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // tier / swale chords
  ctx.strokeStyle = 'rgba(10,14,20,0.16)'
  ctx.lineWidth = 10
  ctx.lineCap = 'round'
  for (const t of l.greenTiers) {
    ctx.beginPath()
    ctx.moveTo(t.a[0], t.a[1])
    ctx.lineTo(t.b[0], t.b[1])
    ctx.stroke()
  }
  ctx.lineCap = 'butt'

  // over-green bunkers (redan front gathering trap) notch the green edge
  for (const b of l.bunkers) {
    if (b.overGreen) drawBunker(ctx, pal, b)
  }

  // tee box
  ctx.fillStyle = pal.fringe
  ctx.fillRect(l.tee[0] - 34, l.tee[1] - 14, 68, 30)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 2
  ctx.strokeRect(l.tee[0] - 34, l.tee[1] - 14, 68, 30)

  // decoration
  for (const d of l.decos) drawDeco(ctx, d, pal)

  // the cup sits ON the green (so balls roll OVER it); the flagstick + flag
  // go on top so the hole is always locatable.
  drawCup(ctx, l.pin)
  drawFlagstick(ctx, l.pin)
}

/** The hole itself: a dark cup with a thin rim, drawn on the green surface so
 * balls (drawn later) sit ON TOP of it rather than vanishing underneath. */
export function drawCup(ctx: Ctx, pin: Pt): void {
  ctx.fillStyle = '#0d1a12'
  ctx.beginPath()
  ctx.ellipse(pin[0], pin[1], 8, 5, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

/** The flagstick + flag at the pin. Exported so the match renderer can re-draw
 * it OVER the players — keeping the pin locatable even in a crowd of balls. The
 * cup is NOT drawn here (it lives under the balls, via drawCup). */
export function drawFlagstick(ctx: Ctx, pin: Pt): void {
  ctx.strokeStyle = '#f2f4f3'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(pin[0], pin[1])
  ctx.lineTo(pin[0], pin[1] - 62)
  ctx.stroke()
  ctx.fillStyle = '#e5322e'
  ctx.beginPath()
  ctx.moveTo(pin[0], pin[1] - 62)
  ctx.lineTo(pin[0] + 34, pin[1] - 52)
  ctx.lineTo(pin[0], pin[1] - 42)
  ctx.closePath()
  ctx.fill()
}

function drawBunker(ctx: Ctx, pal: GolfPalette, b: { x: number; y: number; rx: number; ry: number; rot: number }): void {
  ctx.fillStyle = pal.sand
  ctx.beginPath()
  ctx.ellipse(b.x, b.y, b.rx, b.ry, b.rot, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(10,14,20,0.18)'
  ctx.lineWidth = 3
  ctx.stroke()
}

/** A jagged, faceted ROCK EDGE where the clifftop meets the sea (cliffs env).
 * seaDir = +1 if the open sea lies to the +x side of the boundary bx. */
function drawCliffEdge(ctx: Ctx, bx: number, seaDir: number, top: number, bottom: number): void {
  const depth = 42
  const jag = (y: number): number => bx + seaDir * (4 + 9 * Math.abs(Math.sin(y * 0.11 + 1.3)))
  const landX = bx - seaDir * depth
  // rock body (jagged waterline, straight land side)
  ctx.beginPath()
  ctx.moveTo(landX, top)
  for (let y = top; y <= bottom; y += 20) ctx.lineTo(jag(y), y)
  ctx.lineTo(jag(bottom), bottom)
  ctx.lineTo(landX, bottom)
  ctx.closePath()
  ctx.fillStyle = '#59626d'
  ctx.fill()
  ctx.fillStyle = 'rgba(10,14,20,0.25)' // shaded land-side base
  ctx.fillRect(Math.min(landX, landX - seaDir * 12), top, 12, bottom - top)
  // lit facets toward the water
  ctx.fillStyle = '#828e9b'
  for (let y = top + 12; y < bottom - 22; y += 58) {
    const jx = jag(y)
    ctx.beginPath()
    ctx.moveTo(jx, y)
    ctx.lineTo(jx - seaDir * 17, y + 11)
    ctx.lineTo(jx - seaDir * 5, y + 24)
    ctx.closePath()
    ctx.fill()
  }
  // white surf breaking on the rocks
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 4
  ctx.beginPath()
  for (let y = top; y <= bottom; y += 20) {
    const px = jag(y) + seaDir * 3
    if (y === top) ctx.moveTo(px, y)
    else ctx.lineTo(px, y)
  }
  ctx.stroke()
}

/** A few light shimmer streaks on an inland water ellipse. Static but reads as life. */
function waterShimmer(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.lineWidth = 3
  for (let i = 0; i < 3; i++) {
    const yy = cy - ry * 0.4 + i * ry * 0.42
    const half = rx * (0.45 - i * 0.1)
    ctx.beginPath()
    ctx.moveTo(cx - half, yy)
    ctx.lineTo(cx - half + rx * 0.35, yy)
    ctx.stroke()
  }
}

/** Rolling shimmer bands down the coastal sea strip. */
function seaShimmer(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 3
  for (let yy = y + 40; yy < y + h; yy += 74) {
    ctx.beginPath()
    ctx.moveTo(x + w * 0.15, yy)
    ctx.lineTo(x + w * 0.72, yy + 6)
    ctx.stroke()
  }
}
