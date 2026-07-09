// Golf audio = a rotating ambient golf-course bed (desert birds, cart roll,
// course presence), and NOTHING else. Golf galleries don't roar like a football
// crowd, so there are no cheers/boos/whistles — just the course under the play.
// Deterministic: the same match seed picks the same bed at the same start offset,
// so preview and export (and every re-render) stay identical. Not the sim, so
// this is decoupled from the score-deciding streams.

import { AUDIO_SR } from './audio'
import type { AudioAssetBank } from './audioAssets'

/**
 * Build the golf soundtrack: pick one of the ambient beds by seed (rotating),
 * lay it under the whole clip (play once from a seeded offset, or loop if the
 * bed is shorter than the clip). Returns silence if no bed assets are present.
 */
export function buildGolfAmbientAudio(
  totalSec: number,
  bank: AudioAssetBank,
  seed: number,
): Float32Array {
  const n = Math.max(1, Math.ceil(totalSec * AUDIO_SR))
  const out = new Float32Array(n)
  const beds = bank.golfAmb
  if (beds.length === 0) return out

  const bed = beds[seed % beds.length]
  const gain = 0.6
  if (bed.length > n) {
    const off = seed % (bed.length - n + 1) // guaranteed off + n <= length
    for (let i = 0; i < n; i++) out[i] = bed[off + i] * gain
  } else {
    for (let start = 0; start < n; start += bed.length) {
      const len = Math.min(bed.length, n - start)
      for (let i = 0; i < len; i++) out[start + i] = bed[i] * gain
    }
  }

  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, out[i]))
  return out
}
