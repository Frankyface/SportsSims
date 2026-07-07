# Stage 1 — Foundation & de-risking slice

## Goal
Stand up the app and prove the single riskiest path end-to-end, on ONE hardcoded soccer match, before building anything else. By the end of this stage the whole pipeline — **deterministic sim → Canvas render → Instagram-ready MP4** — works on the live GitHub Pages site.

## Why this stage exists
Research flagged in-browser MP4 export as "the thing most likely to have a hidden showstopper." So we prove it first with a thin vertical slice. If WebCodecs export works here, every later stage is low-risk (the sim, overlays, persistence, and the eventual headless auto-render all reuse this exact slice).

## Features in this stage
- `feature-project-setup-and-deploy.md` — React+Vite+TS app, auto-deploy to GitHub Pages.
- `feature-deterministic-sim-core.md` — the pure `simulateMatch()` + PRNG, on one hardcoded match.
- `feature-canvas-renderer-and-export.md` — dumb Canvas renderer + WebCodecs MP4 download.

## Definition of done
1. Visiting the `*.github.io` URL loads the app (auto-deploys on every push to `main`).
2. Clicking one button runs a **deterministic** match (same result every time) and animates it on Canvas.
3. Clicking "Export" downloads a **1080×1920 H.264/AAC MP4** with the moov atom at the front.
4. **The user manually posts that MP4 to @EliteSimSPN as a Reel and it works** — the real end-to-end proof.

## Blocked by (human)
`help.md` items 1 (enable Pages) — and ideally 2 & 3 (data repo + token) done in advance, though persistence isn't wired until Stage 3.
