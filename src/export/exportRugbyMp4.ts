// In-browser export for RUGBY matches: frame-steps the deterministic rugby
// renderer through WebCodecs H.264 + the shared AAC audio mixer, muxed to an
// Instagram-ready 1080x1920 MP4. Mirrors exportMp4.ts (soccer) — its own
// module so the soccer export path never loads rugby assets and vice-versa.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type { RugbyMatchResult } from '../sim/rugbyTypes'
import type { RugbyMoment } from '../render/rugbyDirector'
import {
  buildRugbyRenderModel,
  drawRugbyFrame,
  RUGBY_RENDER_W,
  RUGBY_RENDER_H,
  type RugbyRenderModel,
} from '../render/rugbyRenderMatch'
import { ensureRugbyLogosLoaded } from '../render/rugbyLogos'
import type { MomentKind } from '../render/director'
import type { RenderModel } from '../render/renderMatch'
import { buildMatchAudio, AUDIO_SR } from './audio'
import { loadAudioAssets } from './audioAssets'

const FPS = 30
const BITRATE = 10_000_000

/**
 * Map rugby moments onto the audio mixer's soccer-shaped cue vocabulary:
 * tries roar like goals (away tries draw home boos), kicked goals earn the
 * mid-size cheer, cards draw jeers, the whistle kinds pass straight through.
 * Everything else stays silent ('miss'/'story' have no cue).
 */
function audioKindFor(m: RugbyMoment): MomentKind {
  switch (m.kind) {
    case 'try':
      return 'goal'
    case 'penaltyGoal':
    case 'dropGoal':
      return 'bigChance'
    case 'conversion':
      // only a GOOD conversion gets a cheer; the label carries the outcome
      return m.label.startsWith('CONVERSION —') ? 'save' : 'miss'
    case 'break':
      return 'save'
    case 'card':
      return 'card'
    case 'kickoff':
    case 'halftime':
    case 'fulltime':
    case 'story':
      return m.kind
    default:
      return 'miss'
  }
}

/**
 * The audio mixer only ever reads plan.{total,playStart,playEnd,resultStart,
 * moments[].kind/t/team} and model.seed — this adapter presents the rugby
 * model through that exact surface (cast is safe by construction; guarded by
 * the field list above staying in sync with export/audio.ts).
 */
function audioModelFor(model: RugbyRenderModel): RenderModel {
  const moments = model.plan.moments.map((m) => ({ ...m, kind: audioKindFor(m) }))
  return {
    ...model,
    plan: { ...model.plan, moments },
  } as unknown as RenderModel
}

async function pickCodec(): Promise<string | null> {
  const candidates = ['avc1.640034', 'avc1.4d0034', 'avc1.42e034', 'avc1.640033', 'avc1.4d0033']
  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width: RUGBY_RENDER_W,
        height: RUGBY_RENDER_H,
        bitrate: BITRATE,
        framerate: FPS,
      })
      if (support.supported) return codec
    } catch {
      /* try next candidate */
    }
  }
  return null
}

async function encodeAudio(
  muxer: Muxer<ArrayBufferTarget>,
  model: RugbyRenderModel,
  onError: (e: unknown) => void,
): Promise<void> {
  const bank = await loadAudioAssets()
  const pcm = buildMatchAudio(audioModelFor(model), bank)
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: onError,
  })
  encoder.configure({ codec: 'mp4a.40.2', sampleRate: AUDIO_SR, numberOfChannels: 1, bitrate: 128_000 })

  const CHUNK = 4800 // 0.1s
  for (let off = 0; off < pcm.length; off += CHUNK) {
    const len = Math.min(CHUNK, pcm.length - off)
    const chunk = new Float32Array(len)
    chunk.set(pcm.subarray(off, off + len))
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: AUDIO_SR,
      numberOfFrames: len,
      numberOfChannels: 1,
      timestamp: Math.round((off / AUDIO_SR) * 1_000_000),
      data: chunk,
    })
    encoder.encode(audioData)
    audioData.close()
  }
  await encoder.flush()
}

/** Render a rugby match to an Instagram-ready MP4 Blob (video + audio). Reports 0..1 progress. */
export async function exportRugbyMatchMp4(
  match: RugbyMatchResult,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('This browser has no WebCodecs support. Use Chrome or Edge to export.')
  }
  const codec = await pickCodec()
  if (!codec) throw new Error('No supported H.264 encoder configuration was found on this device.')

  const model = buildRugbyRenderModel(match, RUGBY_RENDER_W, RUGBY_RENDER_H)
  const totalFrames = Math.max(1, Math.ceil(model.plan.total * FPS))
  await ensureRugbyLogosLoaded()
  const withAudio = typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined'

  const canvas = document.createElement('canvas')
  canvas.width = RUGBY_RENDER_W
  canvas.height = RUGBY_RENDER_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context for export.')

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: RUGBY_RENDER_W, height: RUGBY_RENDER_H },
    ...(withAudio ? { audio: { codec: 'aac' as const, sampleRate: AUDIO_SR, numberOfChannels: 1 } } : {}),
    fastStart: 'in-memory',
  })

  let encodeError: unknown = null
  const onError = (e: unknown) => {
    encodeError = e
  }

  const video = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: onError,
  })
  video.configure({ codec, width: RUGBY_RENDER_W, height: RUGBY_RENDER_H, bitrate: BITRATE, framerate: FPS })

  for (let i = 0; i < totalFrames; i++) {
    if (encodeError) throw encodeError
    drawRugbyFrame(ctx, model, i / FPS)
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((i * 1_000_000) / FPS),
      duration: Math.round(1_000_000 / FPS),
    })
    video.encode(frame, { keyFrame: i % 60 === 0 })
    frame.close()
    onProgress?.((i / totalFrames) * 0.9)
    if (video.encodeQueueSize > 8) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }
  await video.flush()
  if (encodeError) throw encodeError

  if (withAudio) {
    await encodeAudio(muxer, model, onError)
    if (encodeError) throw encodeError
  }

  muxer.finalize()
  onProgress?.(1)
  return new Blob([target.buffer], { type: 'video/mp4' })
}
