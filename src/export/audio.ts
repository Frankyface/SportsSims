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

  // Crowd bed: 1-pole low-passed noise = a murmur (quieter under real music).
  const bedGain = bank.music.length > 0 ? 0.07 : 0.12
  let lp = 0
  for (let i = 0; i < n; i++) {
    const white = rng() * 2 - 1
    lp += (white - lp) * 0.05
    out[i] = lp * bedGain
  }

  // Quieter under the intro and result cards; alive during open play.
  applyGain(out, 0, plan.playStart, 0.55)
  applyGain(out, plan.resultStart, plan.total, 0.6)

  // Swells and hushes around the moments.
  for (const m of plan.moments) {
    if (m.kind === 'goal') applyGain(out, m.t - 0.6, m.t + 2.0, 1.5)
    else if (m.kind === 'bigChance') applyGain(out, m.t - 0.5, m.t + 1.4, 1.35)
    else if (m.kind === 'save' || m.kind === 'miss' || m.kind === 'corner') applyGain(out, m.t - 0.4, m.t + 1.0, 1.2)
    else if (m.kind === 'card') applyGain(out, m.t, m.t + 1.2, 0.7)
  }

  // Background music bed: loop the (deterministically picked) track quietly
  // under the whole clip.
  const music = pick(bank.music, seed, 1)
  if (music) {
    for (let start = 0; start < n; start += music.length) {
      const len = Math.min(music.length, n - start)
      for (let i = 0; i < len; i++) out[start + i] += music[i] * 0.16
    }
    // duck the music slightly under the result card so the whistle reads
    applyGain(out, plan.playEnd, plan.total, 0.85)
  }

  // Whistles at kickoff, half-time and full-time (always procedural — crisp).
  for (const m of plan.moments) {
    if (m.kind === 'kickoff' || m.kind === 'halftime' || m.kind === 'fulltime') {
      addWhistle(out, m.t + 0.05)
    }
  }

  // Crowd reactions: real samples when provided, procedural roar otherwise.
  let momentIdx = 0
  for (const m of plan.moments) {
    momentIdx++
    if (m.kind === 'goal') {
      const cheer = pick(bank.cheer, seed, momentIdx)
      if (cheer) mixSample(out, cheer, m.t, 0.9)
      else addRoar(out, m.t, rng)
    } else if (m.kind === 'bigChance' || m.kind === 'save') {
      const cheer = pick(bank.cheer, seed, momentIdx)
      if (cheer) mixSample(out, cheer, m.t, 0.45)
    } else if (m.kind === 'card') {
      const boo = pick(bank.boo, seed, momentIdx)
      if (boo) mixSample(out, boo, m.t + 0.2, 0.8)
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

function addRoar(out: Float32Array, at: number, rng: () => number): void {
  const start = Math.floor(at * AUDIO_SR)
  const dur = Math.floor(1.6 * AUDIO_SR)
  let lp = 0
  for (let i = 0; i < dur && start + i < out.length; i++) {
    if (start + i < 0) continue
    const p = i / dur
    const env = p < 0.08 ? p / 0.08 : Math.pow(1 - (p - 0.08) / 0.92, 1.5)
    const white = rng() * 2 - 1
    lp += (white - lp) * 0.2
    out[start + i] += lp * env * 0.5
  }
}
