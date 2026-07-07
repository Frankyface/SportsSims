# Handoff — EliteSimSPN
_Last updated: 2026-07-07 · **V1 COMPLETE.** Next: post-V1 (Rugby/Golf, star players, automation)._

## 🎯 Goals
V1 is done: Soccer end-to-end — deterministic **Elo/Glicko-2** sim → animated video (with audio) → Instagram-ready MP4 → persistent league / standings / playoffs → **one-click matchday content pack**. All committed & pushed. Remaining work is post-V1.

## 📍 Current State — V1 shipped & verified
- **Rating model:** Elo/Glicko-2 with randomized starting ratings/RD/volatility, per-season evolution + decay. Verified — Glicko matches the published example; season sim: correlation **0.67**, upset rate **28%**, top-seed title rate **45%** (clear good/bad teams, real upsets, not a coin flip).
- **Match sim:** deterministic possession/xG/momentum model; calibrated (~2.9 goals, ~26 shots, ~23% draws).
- **Video:** Canvas highlight animation (pitch/tokens/ball/scorebug/lower-thirds/cards/intro/result) + procedural audio → **WebCodecs MP4 (avc1 + mp4a, 1080×1920)**; verified valid & ~6× real-time.
- **League:** 10-team double round-robin (90 matches), standings, top-4 playoffs, champion, season rollover with evolved ratings. Persists to **localStorage + a GitHub repo** (Contents API).
- **UI:** tabs — **League** (standings, sim round/season, results→video, matchday content pack), **Friendly**, **Settings** (cloud save/load).
- **Content pack:** one click → a video per game + a standings PNG + prediction-hook captions. Verified end-to-end in the browser.
- **Tests: 21 passing.** Build clean (51 modules). No console errors.

## 📂 Files
- `src/sim` (sim + PRNG), `src/ratings` (Glicko-2, team gen, strength), `src/render` (director, renderer, standings card), `src/export` (WebCodecs video + audio), `src/league` (engine + persistence), `src/content` (captions, matchday pack), `src/ui` (tabs + components), `src/App.tsx`.

## ✅ Things I've Changed (newest first)
- **Stage 4 — matchday content pack** (videos + standings PNG + captions). `8b0d9d7`. **V1 complete.**
- Stage 3 — persistent league + standings + playoffs + persistence + tabbed UI. `dbe4340`.
- Stage 2 — procedural match audio. `366dc9d`.
- Stage 1 — Canvas renderer + WebCodecs export. `e9573e3`.
- Elo/Glicko-2 rating model. `6f8a484`. · Stage 1 core `f9ae6d2`. · Docs scaffold `47395e5`.

## ❌ Tried But Failed / Deferred
- ffmpeg.wasm export fallback for non-WebCodecs browsers (operator uses Chrome) — deferred.
- Audio is basic procedural synthesis — valid track, worth an ear-check.
- **Live GitHub Pages deploy is blocked on the user enabling Pages (`help.md` #1).**

## ➡️ Next Up (post-V1)
1. **User tasks:** enable GitHub Pages (`help.md` #1) to see it live; optionally create the data repo + token (`help.md` #2–3) to use cloud save/load.
2. **Stage 5:** Rugby & Golf (reuse the engine).
3. **Stage 6:** star players & richer drama; public standings page.
4. **Stage 7:** automation ladder (GitHub Actions + Instagram API).

## 🔗 Pointer
→ V1 shipped. Next stage folder: `staging/stage-5-rugby-and-golf/`
→ Active feature file: `staging/stage-5-rugby-and-golf/feature-rugby.md`
