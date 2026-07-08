# Stage 2 — Watchable soccer

> ✅ **Complete & shipped (V1).** Calibrated sim, broadcast overlay (now with real crests + Crown League logo), procedural audio, Friendly tab. ffmpeg fallback deferred (operator uses Chrome).

## Goal
Turn the working-but-basic slice into something **genuinely fun to watch**: a calibrated, dramatic soccer sim wrapped in a broadcast package, plus the "Sim a Match" (friendly) tab so the user can play with it freely.

## Why this stage exists
Watchability is the #1 project risk. A working export of a boring match builds no fandom. This stage is where "is this fun to watch?" becomes an explicit gate before we invest in league infrastructure.

## Features in this stage
- `feature-soccer-sim-engine.md` — calibrated possession/xG/momentum model with believable scores + real drama.
- `feature-broadcast-overlay.md` — the ESPN-style package: scoreboard bug, lower-thirds, intro & result cards, audio.
- `feature-friendly-tab.md` — the sandbox tab: pick/generate two teams, sim, watch, export; nothing saved.
- `feature-export-robustness.md` — the `ffmpeg.wasm` fallback + format/edge-case hardening.

## Definition of done
- Sim a friendly and get a **believable, varied, dramatic ~30s clip** with broadcast polish (scoreline distribution matches real football; upsets happen; late drama exists).
- The clip reads clearly on a phone; the broadcast overlay makes it feel like a real network's match.
- Export works across the intended browser(s), with a fallback path when WebCodecs H.264 isn't available.

## Blocked by
Stage 1 complete.
