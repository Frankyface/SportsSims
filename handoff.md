# Handoff — EliteSimSPN
_Last updated: 2026-07-07 · Current stage: Stage 2 — Watchable soccer (starting). **Stage 1 complete.**_

## 🎯 Goals
Finish V1 (Stages 1–4): Soccer end-to-end — sim → animated video → Instagram-ready MP4 → leagues/standings → one-click matchday content drop. The Elo/Glicko-2 rating model is done. Stage 1 is done. Now Stage 2 (watchability polish + audio + friendly tab).

## 📍 Current State
- **Stage 1 COMPLETE & verified.** App builds/runs; deploy workflow in place; deterministic sim; **Elo/Glicko-2 rating model**; **Canvas match animation**; **WebCodecs MP4 export produces a valid 1080×1920 H.264 `video/mp4`** (verified in-browser: `ftyp` magic, ~8.5 MB for ~34s, encoded ~6× faster than real-time).
- **Rating model verified:** correlation 0.67, upset rate 28%, top-seed title rate 45% — clear good/bad teams, real upsets, not a coin flip.
- **Live app** (preview :5199): generates a 10-team Elo league, plays an animated friendly (pitch / tokens / ball / scorebug / lower-thirds / GOAL flash), and exports an MP4. No console errors.
- **Tests: 15 passing** (determinism, calibration, hygiene, Glicko worked-example, season dynamics).
- **Not done:** audio + ffmpeg fallback (Stage 2), broadcast-overlay polish + proper Friendly-tab UI (Stage 2), leagues/standings/persistence (Stage 3), matchday content drop (Stage 4). Live Pages deploy is blocked on the user enabling Pages (`help.md` #1).

## 📂 Files I'm Working On
- `src/sim/*` (sim + PRNG), `src/ratings/*` (Glicko-2, team gen, strength), `src/render/*` (director + renderer), `src/export/exportMp4.ts` (WebCodecs), `src/ui/MatchCanvas.tsx`, `src/App.tsx`.

## ✅ Things I've Changed (newest first)
- **Stage 1 finished:** Canvas match renderer + WebCodecs MP4 export — valid MP4 verified in-browser. Committed.
- Elo/Glicko-2 rating model with verified season dynamics. Committed `6f8a484`.
- Stage 1 core: scaffold + deterministic sim + tests. Committed `f9ae6d2`. Docs scaffold `47395e5`.

## ❌ Tried But Failed
- Resolved earlier gotchas: dual-Vite config types, 8.3 short path for the preview, `server.fs.strict:false`, and an xG-as-proxy bug (now true xG).
- Audio deliberately deferred to Stage 2 — the export is currently video-only (valid & postable, but silent).

## ➡️ Next Up (Stage 2 — Watchable soccer)
1. Broadcast overlay polish + **audio** (crowd bed + whistle/goal SFX mixed into the MP4 via WebCodecs AudioEncoder).
2. Proper **"Sim a Match" (Friendly) tab** (pick or generate two teams, sim, watch, export — nothing saved).
3. **Export robustness** — ffmpeg.wasm single-thread fallback + clear feature-detection messaging.
4. Then Stage 3 (leagues / standings / persistence) and Stage 4 (matchday content drop). Commit at each stage boundary.
- Reminder: user should enable GitHub Pages (`help.md` #1) to see it live on the web.

## 🔗 Pointer
→ Current stage folder: `staging/stage-2-watchable-soccer/`
→ Active feature file: `staging/stage-2-watchable-soccer/feature-broadcast-overlay.md`
