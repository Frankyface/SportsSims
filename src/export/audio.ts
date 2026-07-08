// Deterministic match audio for the continuous-play engine: a low crowd
// murmur that swells into the big moments, referee whistles at kickoff /
// half-time / full-time, and a roar on every goal. When drop-in sound files
// exist (see src/assets/audio/README.md) the mixer layers them in — a looping
// music bed, real crowd cheers on goals/big chances, boos on cards — with the
// procedural synthesis as the ever-present fallback. Built from the render
// plan's moments + seed so it lines up with the video and re-renders
// identically. Not the sim, so Math.sin/pow are fine here.

import { mulberry32 } from '../sim/prng'
import type { RenderModel } from '../render/renderMatch'
import type { AudioAssetBank } from './audioAssets'

export const AUDIO_SR = 48000

const EMPTY_BANK: AudioAssetBank = { music: [], cheer: [], boo: [] }

function applyGain(out: Float32Array, fromSec: number, toSec: number, gain: number): void {
  const from = Math.max(0, Math.floor(fromSec * AUDIO_SR))
  const to = Math.min(out.length, Math.floor(toSec * AUDIO_SR))
  for (let i = from; i < to; i++) out[i] *= gain
}

/** Additively mix a pre-decoded sample into the master at `atSec`. */
function mixSample(out: Float32Array, sample: Float32Array, atSec: number, gain: number): void {
  const start = Math.floor(atSec * AUDIO_SR)
  for (let i = 0; i < sample.length; i++) {
    const j = start + i
    if (j < 0) continue
    if (j >= out.length) break
    out[j] += sample[i] * gain
  }
}

/**
 * Broadcast-style sidechain duck: dip the crowd bed to `floor` for `holdSec`
 * around `atSec`, with short ramps so a goal cheer / boo sits on TOP of the
 * bed and clearly cuts through instead of being masked by the steady crowd.
 */
function duck(out: Float32Array, atSec: number, holdSec: number, floor: number): void {
  const ramp = Math.floor(0.1 * AUDIO_SR)
  const start = Math.floor((atSec - 0.15) * AUDIO_SR)
  const hold = Math.floor(holdSec * AUDIO_SR)
  for (let i = 0; i < hold; i++) {
    const j = start + i
    if (j < 0 || j >= out.length) continue
    let g = floor
    if (i < ramp) g = 1 - (1 - floor) * (i / ramp)
    else if (i > hold - ramp) g = 1 - (1 - floor) * ((hold - i) / ramp)
    out[j] *= g
  }
}

/** Deterministic pick from a variant pool (same match -> same sound). */
function pick(pool: Float32Array[], seed: number, salt: number): Float32Array | null {
  if (pool.length === 0) return null
  return pool[(seed + salt * 2654435761) % pool.length]
}

export function buildMatchAudio(model: RenderModel, bank: AudioAssetBank = EMPTY_BANK): Float32Array {
  const plan = model.plan
  const n = Math.max(1, Math.ceil(plan.total * AUDIO_SR))
  const out = new Float32Array(n)
  const rng = mulberry32((model.seed ^ 0x51ed270b) >>> 0)
  const seed = model.seed >>> 0

  // Crowd bed: a cascaded low-pass on white noise = a soft, dark MURMUR rather
  // than hiss/static. Two poles at a low cutoff roll off the high end (the
  // "static"); the level is boosted back up to compensate for the lost energy.
  // When a real crowd-ambience file is present it carries the bed, so the synth
  // layer drops to a faint texture underneath it.
  const bedGain = bank.music.length > 0 ? 0.05 : 0.13
  let lp1 = 0
  let lp2 = 0
  for (let i = 0; i < n; i++) {
    const white = rng() * 2 - 1
    lp1 += (white - lp1) * 0.02
    lp2 += (lp1 - lp2) * 0.05
    out[i] = lp2 * bedGain * 7 // gain-compensate for the heavy low-pass
  }

  // Quieter under the intro and result cards; alive during open play.
  applyGain(out, 0, plan.playStart, 0.55)
  applyGain(out, plan.resultStart, plan.total, 0.6)

  // Background ambience bed. When the track is long enough to cover the whole
  // clip (it is — the bed is ~72s vs a max ~69s clip), play it ONCE from a
  // seeded start offset: it never loops back, so a distinctive sound can't
  // recur mid-clip, and different matches start at different points. Only a
  // bed shorter than the clip falls back to looping.
  const music = pick(bank.music, seed, 1)
  if (music) {
    if (music.length > n) {
      const off = seed % (music.length - n + 1) // guaranteed off + n <= length
      for (let i = 0; i < n; i++) out[i] += music[off + i] * 0.16
    } else {
      for (let start = 0; start < n; start += music.length) {
        const len = Math.min(music.length, n - start)
        for (let i = 0; i < len; i++) out[start + i] += music[i] * 0.16
      }
    }
    // duck the music slightly under the result card so the whistle reads
    applyGain(out, plan.playEnd, plan.total, 0.85)
  }

  // Duck the steady bed under each reaction so the goal cheer / boo punches
  // through instead of being masked by the crowd. (Applied to the full bed;
  // the cheers/boos are mixed on top AFTER this.)
  for (const m of plan.moments) {
    if (m.kind === 'goal') duck(out, m.t, 2.8, 0.4)
    else if (m.kind === 'bigChance' || m.kind === 'save') duck(out, m.t, 1.7, 0.6)
    else if (m.kind === 'card') duck(out, m.t + 0.1, 1.7, 0.55)
  }

  // Whistles at kickoff, half-time and full-time (always procedural — crisp).
  for (const m of plan.moments) {
    if (m.kind === 'kickoff' || m.kind === 'halftime' || m.kind === 'fulltime') {
      addWhistle(out, m.t + 0.05)
    }
  }

  // Crowd reactions: real samples when provided, procedural roar otherwise.
  // The stands are the HOME crowd (plus one away section), so the SIDE of an
  // event decides what you hear: home goals roar; away goals get the small
  // travelling-section cheer and the home end's boos; cards against the home
  // side draw louder jeers than cards against the visitors.
  let momentIdx = 0
  for (const m of plan.moments) {
    momentIdx++
    if (m.kind === 'goal') {
      const isHome = m.team === 'home'
      const cheer = pick(bank.cheer, seed, momentIdx)
      if (cheer) mixSample(out, cheer, m.t, isHome ? 1.15 : 0.6)
      else addRoar(out, m.t, rng, isHome ? 0.6 : 0.35)
      if (!isHome) {
        const boo = pick(bank.boo, seed, momentIdx + 13)
        if (boo) mixSample(out, boo, m.t + 0.4, 0.75)
      }
    } else if (m.kind === 'bigChance' || m.kind === 'save' || m.kind === 'corner') {
      const cheer = pick(bank.cheer, seed, momentIdx)
      if (cheer) mixSample(out, cheer, m.t, m.team === 'home' ? 0.6 : 0.3)
    } else if (m.kind === 'card') {
      const boo = pick(bank.boo, seed, momentIdx)
      if (boo) mixSample(out, boo, m.t + 0.2, m.team === 'home' ? 0.9 : 0.6)
    }
  }

  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, out[i]))
  return out
}

function addWhistle(out: Float32Array, at: number): void {
  const start = Math.floor(at * AUDIO_SR)
  const dur = Math.floor(0.35 * AUDIO_SR)
  for (let i = 0; i < dur && start + i < out.length; i++) {
    if (start + i < 0) continue
    const t = i / AUDIO_SR
    const env = Math.sin((Math.PI * i) / dur)
    const trem = 1 + 0.3 * Math.sin(2 * Math.PI * 12 * t)
    out[start + i] += Math.sin(2 * Math.PI * 2100 * t) * env * trem * 0.22
  }
}

function addRoar(out: Float32Array, at: number, rng: () => number, gain = 0.5): void {
  const start = Math.floor(at * AUDIO_SR)
  const dur = Math.floor(1.6 * AUDIO_SR)
  let lp = 0
  for (let i = 0; i < dur && start + i < out.length; i++) {
    if (start + i < 0) continue
    const p = i / dur
    const env = p < 0.08 ? p / 0.08 : Math.pow(1 - (p - 0.08) / 0.92, 1.5)
    const white = rng() * 2 - 1
    lp += (white - lp) * 0.2
    out[start + i] += lp * env * gain
  }
}
