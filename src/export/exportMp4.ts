// In-browser export: frame-step the deterministic renderer through a WebCodecs
// H.264 encoder + a procedural AAC audio track, muxed to a real Instagram-ready
// 1080x1920 MP4 (moov atom at front). No server, no ffmpeg, no cross-origin
// isolation headers required.
//
// A ffmpeg.wasm fallback for browsers without WebCodecs H.264 is a documented
// follow-up; the target operator runs Chrome/Edge, which is fully covered.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type { MatchResult } from '../sim/types'
import { buildRenderModel, drawFrame, RENDER_W, RENDER_H, type RenderModel } from '../render/renderMatch'
import { ensureLogosLoaded } from '../render/logos'
import { buildMatchAudio, AUDIO_SR } from './audio'
import { loadAudioAssets } from './audioAssets'

const FPS = 30
const BITRATE = 10_000_000

async function pickCodec(): Promise<string | null> {
  const candidates = ['avc1.640034', 'avc1.4d0034', 'avc1.42e034', 'avc1.640033', 'avc1.4d0033']
  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width: RENDER_W,
        height: RENDER_H,
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

async function encodeAudio(muxer: Muxer<ArrayBufferTarget>, model: RenderModel, onError: (e: unknown) => void): Promise<void> {
  // drop-in cheers/boos/music decode once and cache; empty bank = procedural
  const bank = await loadAudioAssets()
  const pcm = buildMatchAudio(model, bank)
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

/** Render `match` to an Instagram-ready MP4 Blob (video + audio). Reports 0..1 progress. */
export async function exportMatchMp4(match: MatchResult, onProgress?: (p: number) => void, opts?: { audio?: boolean }): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('This browser has no WebCodecs support. Use Chrome or Edge to export.')
  }
  const codec = await pickCodec()
  if (!codec) throw new Error('No supported H.264 encoder configuration was found on this device.')

  const model = buildRenderModel(match, RENDER_W, RENDER_H)
  const totalFrames = Math.max(1, Math.ceil(model.plan.total * FPS))
  await ensureLogosLoaded()
  let withAudio = opts?.audio !== false && typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined'
  if (withAudio) {
    // Some environments (e.g. Linux CI Chromium) expose AudioEncoder but have no
    // AAC encoder — probe first so we degrade to a video-only MP4 instead of
    // throwing "Unsupported codec type" mid-export. (CI adds the audio via ffmpeg.)
    try {
      const sup = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: AUDIO_SR, numberOfChannels: 1, bitrate: 128_000 })
      withAudio = sup.supported === true
    } catch {
      withAudio = false
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = RENDER_W
  canvas.height = RENDER_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context for export.')

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: RENDER_W, height: RENDER_H },
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
  video.configure({ codec, width: RENDER_W, height: RENDER_H, bitrate: BITRATE, framerate: FPS })

  for (let i = 0; i < totalFrames; i++) {
    if (encodeError) throw encodeError
    drawFrame(ctx, model, i / FPS)
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

/** Trigger a browser download of a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
