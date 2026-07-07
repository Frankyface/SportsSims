# Feature — Canvas renderer & WebCodecs export

## What
A "dumb" Canvas renderer that plays back a `MatchResult`'s event timeline as tokens-on-a-pitch, plus the **WebCodecs export** that turns that playback into a downloadable Instagram-ready MP4. First pass can be visually basic — the point is the pipeline.

## Why
Proves the highest-risk technical bet (in-browser MP4 on GitHub Pages) and establishes the render/export interface every later stage reuses (broadcast overlay, batch export, headless re-render).

## Acceptance criteria
- [ ] Renderer is a pure function of `(events, renderSeed, frameIndex)` at a fixed timestep — no wall-clock/rAF dependence for the export path.
- [ ] Live preview: watch the match play on Canvas in the browser.
- [ ] Export: frame-step the sim → `VideoEncoder` (H.264 `avc1`) + `AudioEncoder` (AAC-LC) → **`mp4-muxer`** (`fastStart:'in-memory'`) → download `.mp4`.
- [ ] Output is **1080×1920, 30fps, H.264/AAC, moov-at-front**; plays in a browser and uploads as an IG Reel.
- [ ] Feature-detect `VideoEncoder.isConfigSupported()`; if absent, show a clear message (real fallback is Stage 2's `feature-export-robustness`).
- [ ] Key graphics kept inside the IG **safe band** (avoid top ~220px, bottom ~400–450px).

## Technical notes
See `docs/research-findings.md` §1. WebCodecs primary (no COOP/COEP needed). Non-linear time edit (dwell on goals) can be minimal here and refined in Stage 2. Cosmetic randomness uses a separate `renderSeed`, never the sim seed.

## Open Questions
- 30fps confirmed for v1? (IG-recommended, halves encode work.) 60fps later is possible but IG compresses it harder.
- Fixed 30s always, or variable 25–40s by goal count? Affects the time-mapping curve.
- Audio in the slice: silent first, or a basic crowd/whistle bed immediately? (Silent is fine to prove the pipeline; audio can land in Stage 2.)
