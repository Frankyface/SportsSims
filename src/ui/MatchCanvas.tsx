import { useEffect, useRef } from 'react'
import type { MatchResult } from '../sim/types'
import { buildRenderModel, drawFrame, RENDER_W, RENDER_H } from '../render/renderMatch'
import { ensureLogosLoaded } from '../render/logos'

/** Live preview: plays the deterministic render plan in real time and loops. */
export function MatchCanvas({ match, playKey }: { match: MatchResult; playKey: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const model = buildRenderModel(match)
    // Start rendering immediately (crests fall back to colour chips); logos pop in once loaded.
    void ensureLogosLoaded()
    let raf = 0
    let start = 0
    const loop = (ts: number) => {
      if (!start) start = ts
      let t = (ts - start) / 1000
      if (t > model.plan.total) {
        start = ts
        t = 0
      }
      drawFrame(ctx, model, t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [match, playKey])

  return <canvas ref={ref} width={RENDER_W} height={RENDER_H} className="matchCanvas" />
}
