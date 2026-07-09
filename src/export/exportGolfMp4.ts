// In-browser export for GOLF rounds: frame-steps the deterministic golf
// renderer through WebCodecs H.264 + the shared AAC audio mixer, muxed to an
// Instagram-ready 1080x1920 MP4. Mirrors exportRugbyMp4.ts — its own module so
// the other sports' export paths never load golf art and vice-versa. (The
// Tuesday course preview is a 10-image carousel, not a video — see
// golfCoursePreview.ts.)

import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import {
  drawGolfFrame,
  GOLF_RENDER_W,
  GOLF_RENDER_H,
  type GolfRenderModel,
} from '../render/golfRenderMatch'
import { ensureFontsLoaded } from '../render/fonts'
import { ensureSgaLogo } from '../render/golfBrand'
import { ensureEventLogo } from '../render/golfEventLogos'
import { AUDIO_SR } from './audio'
import { loadAudioAssets } from './audioAssets'
import { buildGolfAmbientAudio } from './golfAudio'

const FPS = 30
const BITRATE = 10_000_000

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
  const pcm = buildGolfAmbientAudio(model.plan.total, bank, model.seed >>> 0)
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

/**
 * The shared golf WebCodecs encoder: frame-steps `draw(ctx, t)` over `total`
 * seconds at FPS into an H.264 MP4, optionally muxing an AAC track produced by
 * `addAudio`. Used by both the round export (with match audio) and the silent
 * course-preview export.
 */
async function encodeGolfMp4(
  opts: {
    total: number
    draw: (ctx: CanvasRenderingContext2D, t: number) => void
    eventId?: string
    addAudio?: (muxer: Muxer<ArrayBufferTarget>, onError: (e: unknown) => void) => Promise<void>
  },
  onProgress?: (p: number) => void,
): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('This browser has no WebCodecs support. Use Chrome or Edge to export.')
  }
  const codec = await pickCodec()
  if (!codec) throw new Error('No supported H.264 encoder configuration was found on this device.')

  const totalFrames = Math.max(1, Math.ceil(opts.total * FPS))
  await Promise.all([
    ensureFontsLoaded(),
    ensureSgaLogo(),
    opts.eventId ? ensureEventLogo(opts.eventId) : Promise.resolve(),
  ])
  const withAudio =
    !!opts.addAudio && typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined'

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

  const videoShare = withAudio ? 0.9 : 1
  for (let i = 0; i < totalFrames; i++) {
    if (encodeError) throw encodeError
    opts.draw(ctx, i / FPS)
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((i * 1_000_000) / FPS),
      duration: Math.round(1_000_000 / FPS),
    })
    video.encode(frame, { keyFrame: i % 60 === 0 })
    frame.close()
    onProgress?.((i / totalFrames) * videoShare)
    if (video.encodeQueueSize > 8) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }
  await video.flush()
  if (encodeError) throw encodeError

  if (withAudio && opts.addAudio) {
    await opts.addAudio(muxer, onError)
    if (encodeError) throw encodeError
  }

  muxer.finalize()
  onProgress?.(1)
  return new Blob([target.buffer], { type: 'video/mp4' })
}

/** Render a golf round to an Instagram-ready MP4 Blob (video + audio). Reports 0..1 progress. */
export function exportGolfRoundMp4(
  model: GolfRenderModel,
  onProgress?: (p: number) => void,
  opts?: { audio?: boolean },
): Promise<Blob> {
  return encodeGolfMp4(
    {
      total: model.plan.total,
      draw: (ctx, t) => drawGolfFrame(ctx, model, t),
      eventId: model.event.id,
      // audio:false → video-only (CI adds the ambient bed via ffmpeg from a WAV).
      ...(opts?.audio === false ? {} : { addAudio: (muxer, onError) => encodeAudio(muxer, model, onError) }),
    },
    onProgress,
  )
}
