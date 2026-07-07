// Deterministic procedural match audio: a low crowd murmur that lifts during
// chances, a referee whistle at kickoff and full-time, and a roar on every goal.
// Built from the render plan + seed so it lines up with the video and re-renders
// identically. Not the sim, so Math.sin/pow are fine here.

import { mulberry32 } from '../sim/prng'
import type { RenderModel } from '../render/renderMatch'

export const AUDIO_SR = 48000

export function buildMatchAudio(model: RenderModel): Float32Array {
  const n = Math.max(1, Math.ceil(model.plan.total * AUDIO_SR))
  const out = new Float32Array(n)
  const rng = mulberry32((model.seed ^ 0x51ed270b) >>> 0)

  // Crowd bed: 1-pole low-passed noise = a murmur.
  let lp = 0
  for (let i = 0; i < n; i++) {
    const white = rng() * 2 - 1
    lp += (white - lp) * 0.05
    out[i] = lp * 0.12
  }

  // Amplitude-modulate by beat intensity (louder in the action, quiet on cards).
  for (const b of model.plan.beats) {
    const from = Math.floor(b.start * AUDIO_SR)
    const to = Math.min(n, Math.floor((b.start + b.dur) * AUDIO_SR))
    const gain =
      b.kind === 'goal' || b.kind === 'bigChance'
        ? 1.5
        : b.kind === 'intro' || b.kind === 'result' || b.kind === 'card'
          ? 0.6
          : 1.0
    for (let i = from; i < to; i++) out[i] *= gain
  }

  // Whistles at kickoff and full-time.
  addWhistle(out, 0.15)
  const last = model.plan.beats[model.plan.beats.length - 1]
  addWhistle(out, last.start + 0.05)

  // Roar on each goal (at the strike moment).
  for (const b of model.plan.beats) {
    if (b.kind === 'goal') addRoar(out, b.start + b.dur * 0.72, rng)
  }

  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, out[i]))
  return out
}

function addWhistle(out: Float32Array, at: number): void {
  const start = Math.floor(at * AUDIO_SR)
  const dur = Math.floor(0.35 * AUDIO_SR)
  for (let i = 0; i < dur && start + i < out.length; i++) {
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
    const p = i / dur
    const env = p < 0.08 ? p / 0.08 : Math.pow(1 - (p - 0.08) / 0.92, 1.5)
    const white = rng() * 2 - 1
    lp += (white - lp) * 0.2
    out[start + i] += lp * env * 0.5
  }
}
