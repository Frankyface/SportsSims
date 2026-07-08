// Procedural golf-hole art — every Apex Tour course gets a distinct look.
//
// A GolfHoleLayout is built once per (renderSeed, course, hole): a seeded
// fairway ribbon from the tee (bottom) to the green (top), hazards, and
// environment decoration. holeToScreen() maps the sim's normalized hole
// coordinates onto that ribbon, so the abstract shot positions land on the
// drawn fairway. Pure render-side code — cosmetic randomness only, on its own
// stream (mulberry32 of renderSeed ^ hole), never the score stream.

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

interface Deco {
  x: number
  y: number
  s: number // size scale
  kind: DecoKind
}

export interface GolfHoleLayout {
  hole: GolfHoleDef
  env: GolfEnv
  tee: [number, number]
  greenC: [number, number]
  greenR: number
  pin: [number, number]
  /** quadratic control point of the fairway centreline */
  ctrl: [number, number]
  halfWidth: number // fairway corridor half-width in px
  corridor: number // lateral scale: sim x = ±1 → ±corridor px
  waterSide: -1 | 1
  bunkers: Array<{ x: number; y: number; rx: number; ry: number }>
  water: { x: number; y: number; rx: number; ry: number } | null
  seaEdge: boolean // coast/links/cliffs: a sea strip runs along the water side
  decos: Deco[]
}

function pointOnPath(l: GolfHoleLayout, t: number): [number, number] {
  const u = 1 - t
  const x = u * u * l.tee[0] + 2 * u * t * l.ctrl[0] + t * t * l.greenC[0]
  const y = u * u * l.tee[1] + 2 * u * t * l.ctrl[1] + t * t * l.greenC[1]
  return [x, y]
}

/** Map sim hole coords (x lateral -1..1, y 0 tee..1 pin) to screen px. */
export function holeToScreen(l: GolfHoleLayout, pos: [number, number]): [number, number] {
  const [lx, ly] = pos
  if (ly >= 0.955) {
    // On/around the green: place relative to the pin by the sim's green units.
    const d = (1 - ly) / 0.08 // 0..~0.55 green units
    const px = l.pin[0] + lx * l.greenR * 1.5
    const py = l.pin[1] + d * l.greenR * 1.55
    return [px, py]
  }
  const [cx, cy] = pointOnPath(l, ly)
  return [cx + lx * l.corridor, cy]
}

/** Build the seeded layout for one hole of a course. */
export function buildHoleLayout(course: GolfCourseDef, holeIdx: number, renderSeed: number): GolfHoleLayout {
  const rng = mulberry32((renderSeed ^ Math.imul(holeIdx + 1, 0x9e3779b9)) >>> 0)
  const hole = course.holes[holeIdx]
  const pal = PALETTES[course.env]
  // Keep the green clear of the leaderboard rail (x ≥ 800): centre the hole
  // slightly left and cap its lateral drift.
  const cx = GOLF_ART.x + GOLF_ART.w / 2 - 60
  const teeX = cx + (rng() * 2 - 1) * 120
  const tee: [number, number] = [teeX, GOLF_ART.y + GOLF_ART.h - 130]
  const greenX = cx + (rng() * 2 - 1) * 120
  const greenY = GOLF_ART.y + 235 + rng() * 60
  const greenR = hole.par === 3 ? 96 : 88
  const bend = (rng() * 2 - 1) * (hole.par === 5 ? 260 : hole.par === 4 ? 200 : 90)
  const ctrl: [number, number] = [(teeX + greenX) / 2 + bend, (tee[1] + greenY) / 2 + (rng() * 2 - 1) * 60]
  const waterSide: -1 | 1 = rng() < 0.5 ? -1 : 1
  const corridor = 250
  const halfWidth = hole.par === 3 ? 78 : 96 - hole.hazard * 22

  const layout: GolfHoleLayout = {
    hole,
    env: course.env,
    tee,
    greenC: [greenX, greenY],
    greenR,
    pin: [greenX + (rng() * 2 - 1) * greenR * 0.35, greenY + (rng() * 2 - 1) * greenR * 0.3],
    ctrl,
    halfWidth,
    corridor,
    waterSide,
    bunkers: [],
    water: null,
    seaEdge: course.env === 'coast' || course.env === 'links' || course.env === 'cliffs',
    decos: [],
  }

  // Bunkers: greenside first, then a fairway trap at the landing elbow.
  const nBunk = 1 + Math.round(hole.hazard * 2.2)
  for (let i = 0; i < nBunk; i++) {
    if (i === 0 || hole.par === 3) {
      const side = rng() < 0.5 ? -1 : 1
      layout.bunkers.push({
        x: greenX + side * (greenR + 34 + rng() * 22),
        y: greenY + (rng() * 2 - 1) * greenR * 0.8,
        rx: 34 + rng() * 18,
        ry: 24 + rng() * 12,
      })
    } else {
      const [ex, ey] = pointOnPath(layout, 0.55 + rng() * 0.2)
      const side = rng() < 0.5 ? -1 : 1
      layout.bunkers.push({ x: ex + side * (halfWidth + 42), y: ey, rx: 40 + rng() * 20, ry: 26 + rng() * 12 })
    }
  }

  // Water body (inland holes). Sea-edge courses use the sea strip instead.
  if (hole.water && !layout.seaEdge) {
    const along = 0.55 + rng() * 0.3
    const [wx, wy] = pointOnPath(layout, along)
    layout.water = {
      x: wx + layout.waterSide * (halfWidth + 150),
      y: wy,
      rx: 150 + rng() * 70,
      ry: 190 + rng() * 90,
    }
  }

  // Environment decoration scattered outside the fairway corridor.
  const nDeco = 26
  for (let i = 0; i < nDeco; i++) {
    const along = rng()
    const [px, py] = pointOnPath(layout, along)
    const side = rng() < 0.5 ? -1 : 1
    const off = halfWidth + 60 + rng() * 240
    const x = px + side * off
    const y = py + (rng() * 2 - 1) * 30
    if (x < GOLF_ART.x + 18 || x > GOLF_ART.x + GOLF_ART.w - 18) continue
    if (y < GOLF_ART.y + 150 || y > GOLF_ART.y + GOLF_ART.h - 40) continue
    if (layout.water) {
      const dx = (x - layout.water.x) / layout.water.rx
      const dy = (y - layout.water.y) / layout.water.ry
      if (dx * dx + dy * dy < 1.35) continue
    }
    layout.decos.push({ x, y, s: 0.7 + rng() * 0.7, kind: rng() < 0.72 ? pal.deco1 : pal.deco2 })
  }
  return layout
}

type Ctx = CanvasRenderingContext2D

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
      ctx.arc(0, -14 * s, 15 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = pal.decoAlt
      ctx.beginPath()
      ctx.arc(6 * s, -20 * s, 8 * s, 0, Math.PI * 2)
      ctx.fill()
      break
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
        ctx.arc(i * 7 * s, 0, 5 * s, 0, Math.PI * 2)
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

/** Paint one hole: terrain, hazards, green, tee, decoration. Pure fn of layout. */
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
  // env silhouette: jagged for peaks/mesas, soft humps otherwise
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
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(l.waterSide < 0 ? x + w - 8 : x, A.y + 118, 8, A.h - 118)
  }

  // inland water body
  if (l.water) {
    ctx.fillStyle = pal.water
    ctx.beginPath()
    ctx.ellipse(l.water.x, l.water.y, l.water.rx, l.water.ry, 0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 4
    ctx.stroke()
  }

  // fairway ribbon: stroke the centreline path fat, then a lighter core
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = pal.fairway
  ctx.lineWidth = l.halfWidth * 2
  ctx.beginPath()
  ctx.moveTo(l.tee[0], l.tee[1])
  ctx.quadraticCurveTo(l.ctrl[0], l.ctrl[1], l.greenC[0], l.greenC[1])
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = l.halfWidth * 1.15
  ctx.beginPath()
  ctx.moveTo(l.tee[0], l.tee[1])
  ctx.quadraticCurveTo(l.ctrl[0], l.ctrl[1], l.greenC[0], l.greenC[1])
  ctx.stroke()

  // bunkers
  for (const b of l.bunkers) {
    ctx.fillStyle = pal.sand
    ctx.beginPath()
    ctx.ellipse(b.x, b.y, b.rx, b.ry, 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(10,14,20,0.18)'
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // green + fringe + pin
  ctx.fillStyle = pal.fringe
  ctx.beginPath()
  ctx.ellipse(l.greenC[0], l.greenC[1], l.greenR + 16, l.greenR * 0.86 + 16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = pal.green
  ctx.beginPath()
  ctx.ellipse(l.greenC[0], l.greenC[1], l.greenR, l.greenR * 0.86, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 3
  ctx.stroke()

  // tee box
  ctx.fillStyle = pal.fringe
  ctx.fillRect(l.tee[0] - 34, l.tee[1] - 14, 68, 30)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 2
  ctx.strokeRect(l.tee[0] - 34, l.tee[1] - 14, 68, 30)

  // decoration
  for (const d of l.decos) drawDeco(ctx, d, pal)

  // flagstick last so it reads over everything
  ctx.strokeStyle = '#f2f4f3'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(l.pin[0], l.pin[1])
  ctx.lineTo(l.pin[0], l.pin[1] - 62)
  ctx.stroke()
  ctx.fillStyle = '#e5322e'
  ctx.beginPath()
  ctx.moveTo(l.pin[0], l.pin[1] - 62)
  ctx.lineTo(l.pin[0] + 34, l.pin[1] - 52)
  ctx.lineTo(l.pin[0], l.pin[1] - 42)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(10,14,20,0.5)'
  ctx.beginPath()
  ctx.ellipse(l.pin[0], l.pin[1] + 3, 7, 3.4, 0, 0, Math.PI * 2)
  ctx.fill()
}
