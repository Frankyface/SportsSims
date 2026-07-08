// Drop-in audio asset bank: discovers sound files in src/assets/audio/ by
// name prefix (music- / cheer- / boo-), decodes them once to 48kHz mono
// Float32Arrays, and hands them to the audio mixer. With no files present the
// bank is empty and the mixer falls back to procedural synthesis — the folder
// is a pure enhancement seam, mirroring how logos.ts preloads crests.

import { AUDIO_SR } from './audio'

export interface AudioAssetBank {
  music: Float32Array[]
  cheer: Float32Array[]
  boo: Float32Array[]
}

// Vite turns each matching asset into a URL we can fetch at runtime.
const ASSET_URLS = import.meta.glob('../assets/audio/*.{wav,mp3,ogg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

let bankPromise: Promise<AudioAssetBank> | null = null

function roleOf(path: string): keyof AudioAssetBank | null {
  const name = path.split('/').pop() ?? ''
  if (name.startsWith('music-')) return 'music'
  if (name.startsWith('cheer-')) return 'cheer'
  if (name.startsWith('boo-')) return 'boo'
  return null
}

/** Decode a file to mono Float32 at the export sample rate. */
async function decodeToMono(url: string): Promise<Float32Array | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const ctx = new OfflineAudioContext(1, 1, AUDIO_SR)
    const decoded = await ctx.decodeAudioData(buf)
    // resample + downmix by rendering through an OfflineAudioContext
    const frames = Math.ceil(decoded.duration * AUDIO_SR)
    if (frames <= 0) return null
    const render = new OfflineAudioContext(1, frames, AUDIO_SR)
    const src = render.createBufferSource()
    src.buffer = decoded
    src.connect(render.destination)
    src.start(0)
    const out = await render.startRendering()
    return out.getChannelData(0).slice()
  } catch {
    return null // a bad file never breaks an export — it is just skipped
  }
}

/** Load (once) every discovered asset. Sorted by filename for determinism. */
export function loadAudioAssets(): Promise<AudioAssetBank> {
  if (!bankPromise) {
    bankPromise = (async () => {
      const bank: AudioAssetBank = { music: [], cheer: [], boo: [] }
      const entries = Object.entries(ASSET_URLS).sort(([a], [b]) => (a < b ? -1 : 1))
      for (const [path, url] of entries) {
        const role = roleOf(path)
        if (!role) continue
        const pcm = await decodeToMono(url)
        if (pcm && pcm.length > 0) bank[role].push(pcm)
      }
      return bank
    })()
  }
  return bankPromise
}

/** True if any drop-in sound exists (decides procedural-vs-asset mixing). */
export function hasAnyAssets(): boolean {
  return Object.keys(ASSET_URLS).length > 0
}
