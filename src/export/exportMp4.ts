// In-browser export: frame-step the deterministic renderer through a WebCodecs
// H.264 encoder and mux to a real Instagram-ready 1080x1920 MP4 (moov atom at
// front). No server, no ffmpeg, no cross-origin-isolation headers required.
//
// Audio is added in Stage 2 (broadcast overlay). A ffmpeg.wasm fallback for
// browsers without WebCodecs H.264 also lands in Stage 2.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type { MatchResult } from '../sim/types'
import { buildRenderModel, drawFrame, RENDER_W, RENDER_H } from '../render/renderMatch'

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

/** Render `match` to an Instagram-ready MP4 Blob. Reports 0..1 progress. */
export async function exportMatchMp4(match: MatchResult, onProgress?: (p: number) => void): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('This browser has no WebCodecs support. Use Chrome/Edge, or wait for the Stage-2 fallback exporter.')
  }
  const codec = await pickCodec()
  if (!codec) throw new Error('No supported H.264 encoder configuration was found on this device.')

  const model = buildRenderModel(match, RENDER_W, RENDER_H)
  const totalFrames = Math.max(1, Math.ceil(model.plan.total * FPS))

  const canvas = document.createElement('canvas')
  canvas.width = RENDER_W
  canvas.height = RENDER_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a 2D canvas context for export.')

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: RENDER_W, height: RENDER_H },
    fastStart: 'in-memory',
  })

  let encodeError: unknown = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e
    },
  })
  encoder.configure({ codec, width: RENDER_W, height: RENDER_H, bitrate: BITRATE, framerate: FPS })

  for (let i = 0; i < totalFrames; i++) {
    if (encodeError) throw encodeError
    drawFrame(ctx, model, i / FPS)
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((i * 1_000_000) / FPS),
      duration: Math.round(1_000_000 / FPS),
    })
    encoder.encode(frame, { keyFrame: i % 60 === 0 })
    frame.close()
    onProgress?.(i / totalFrames)
    // Keep the encoder queue bounded so the tab stays responsive.
    if (encoder.encodeQueueSize > 8) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }

  await encoder.flush()
  if (encodeError) throw encodeError
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
