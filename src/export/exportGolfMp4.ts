// In-browser export for GOLF rounds: frame-steps the deterministic golf
// renderer through WebCodecs H.264 + the shared AAC audio mixer, muxed to an
// Instagram-ready 1080x1920 MP4. Mirrors exportRugbyMp4.ts — its own module so
// the other sports' export paths never load golf art and vice-versa.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type { GolfMoment } from '../render/golfDirector'
import {
  drawGolfFrame,
  GOLF_RENDER_W,
  GOLF_RENDER_H,
  type GolfRenderModel,
} from '../render/golfRenderMatch'
import { ensureFontsLoaded } from '../render/fonts'
import type { Moment, MomentKind, RenderPlan } from '../render/director'
import type { RenderModel } from '../render/renderMatch'
import type { TeamRating } from '../sim/types'
import { buildMatchAudio, AUDIO_SR } from './audio'
import { loadAudioAssets } from './audioAssets'

const FPS = 30
const BITRATE = 10_000_000

/**
 * Map golf moments onto the audio mixer's cue vocabulary: aces/eagles/the
 * winning putt roar like goals, birdies and lead changes earn the mid-size
 * cheer, water balls and disasters draw the gallery groan. Golf has NO
 * whistles — the kickoff/halftime/fulltime kinds are never emitted.
 */
function audioKindFor(m: GolfMoment): MomentKind {
  switch (m.kind) {
    case 'ace':
    case 'eagle':
    case 'winner':
      return 'goal'
    case 'birdie':
    case 'longPutt':
    case 'leadChange':
      return 'bigChance'
    case 'splash':
    case 'double':
      return 'card'
    default:
      return 'miss' // bogey — silent
  }
}

/** A golfer presented as the mixer's team shape (it only reads plan+seed). */
function neutralTeam(model: GolfRenderModel, idx: number): TeamRating {
  const g = model.m.config.golfers[idx]
  return {
    id: g.id,
    name: g.name,
    abbr: g.abbr,
    city: '',
    color: g.color,
    colorAlt: g.colorAlt,
    attack: 1,
    defense: 1,
    finishing: 1,
    discipline: 1,
    formSpread: g.formSpread,
  }
}

/**
 * Present the golf model to the shared audio mixer as a REAL RenderModel — no
 * casts. Moments are re-keyed into the cue vocabulary; cheers ride the 'home'
 * gain (full-throated gallery), groans the 'away' gain (a murmur of pain).
 */
function audioModelFor(model: GolfRenderModel): RenderModel {
  const moments: Moment[] = model.plan.moments.map((m) => {
    const kind = audioKindFor(m)
    return {
      t: m.t,
      dur: m.dur,
      kind,
      team: kind === 'card' ? ('away' as const) : ('home' as const),
      minute: m.hole + 1,
      label: m.label,
    }
  })
  const plan: RenderPlan = {
    total: model.plan.total,
    introDur: model.plan.introDur,
    playStart: model.plan.playStart,
    playEnd: model.plan.playEnd,
    resultStart: model.plan.resultStart,
    resultDur: model.plan.resultDur,
    segs: [],
    clockPts: [],
    scorePts: [],
    moments,
    sendOffs: [],
  }
  return {
    plan,
    home: neutralTeam(model, 0),
    away: neutralTeam(model, 1),
    finalScore: [0, 0],
    width: model.width,
    height: model.height,
    seed: model.seed,
  }
}

async function pickCodec(): Promise<string | null> {
  const candidates = ['avc1.640034', 'avc1.4d0034', 'avc1.42e034', 'avc1.640033', 'avc1.4d0033']
  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width: GOLF_RENDER_W,
        height: GOLF_RENDER_H,
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
  model: GolfRenderModel,
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

/** Render a golf round to an Instagram-ready MP4 Blob (video + audio). Reports 0..1 progress. */
export async function exportGolfRoundMp4(
  model: GolfRenderModel,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('This browser has no WebCodecs support. Use Chrome or Edge to export.')
  }
  const codec = await pickCodec()
  if (!codec) throw new Error('No supported H.264 encoder configuration was found on this device.')

  const totalFrames = Math.max(1, Math.ceil(model.plan.total * FPS))
  await ensureFontsLoaded()
  const withAudio = typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined'

  const canvas = document.createElement('canvas')
  canvas.width = GOLF_RENDER_W
  canvas.height = GOLF_RENDER_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context for export.')

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: GOLF_RENDER_W, height: GOLF_RENDER_H },
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
  video.configure({ codec, width: GOLF_RENDER_W, height: GOLF_RENDER_H, bitrate: BITRATE, framerate: FPS })

  for (let i = 0; i < totalFrames; i++) {
    if (encodeError) throw encodeError
    drawGolfFrame(ctx, model, i / FPS)
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
