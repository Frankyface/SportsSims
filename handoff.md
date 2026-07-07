# Handoff — EliteSimSPN
_Last updated: 2026-07-07 · Current stage: Stage 3 — Leagues & standings (starting). **Stages 1–2 complete.**_

## 🎯 Goals
Finish V1 (Stages 1–4): Soccer end-to-end — sim → animated video (with audio) → Instagram-ready MP4 → **persistent leagues/standings** → **one-click matchday content drop**. Rating model + video pipeline are done; Stage 3 makes the world persistent.

## 📍 Current State
- **Stages 1–2 COMPLETE & verified.** Deterministic sim; **Elo/Glicko-2 rating model**; Canvas match animation; **WebCodecs export → valid 1080×1920 MP4 with video (`avc1`) + audio (`mp4a`)**, ~9 MB / ~34s, encoded ~6× real-time. Broadcast overlay (scorebug, lower-thirds, intro/result, wordmark) + procedural audio (crowd/whistle/goal roars). A working friendly viewer generates a 10-team Elo league and exports clips.
- **Rating model:** correlation 0.67, upset rate 28%, top-seed title rate 45% — clear good/bad teams, real upsets, not a coin flip.
- **Tests: 15 passing.** App builds clean (38 modules). No console errors.
- **Not done:** persistent leagues/standings/persistence (Stage 3), matchday content drop (Stage 4). Deferred: ffmpeg export fallback for non-WebCodecs browsers (operator uses Chrome). Live Pages deploy blocked on the user enabling Pages (`help.md` #1).

## 📂 Files
- `src/sim/*` (sim + PRNG), `src/ratings/*` (Glicko-2, team gen, strength), `src/render/*` (director + renderer), `src/export/*` (WebCodecs video + procedural audio), `src/ui/MatchCanvas.tsx`, `src/App.tsx`.

## ✅ Things I've Changed (newest first)
- **Stage 2 done:** procedural match **audio** (crowd + whistle + goal roars) → AAC, muxed alongside video (verified `avc1` + `mp4a`). Overlay + friendly viewer in place. Committed.
- **Stage 1 done:** Canvas renderer + WebCodecs MP4 export (valid MP4 verified in-browser). Committed `e9573e3`.
- Elo/Glicko-2 rating model (verified season dynamics). Committed `6f8a484`.
- Stage 1 core scaffold + sim + tests `f9ae6d2`; docs scaffold `47395e5`.

## ❌ Tried But Failed
- Resolved gotchas: dual-Vite config types, 8.3 short path for preview, `server.fs.strict:false`, xG-as-proxy bug, typed-array `BufferSource` strictness (copy chunk).
- Audio quality is basic procedural synthesis — valid track, but not verifiable by ear here; flagged for user review.

## ➡️ Next Up (Stage 3 — Leagues & standings)
1. **League engine:** double round-robin fixtures (18 matchdays), season lifecycle, playoffs, champion → archive to history → Glicko decay/regress into next season.
2. **Standings + team pages UI** with tabs (Friendly / League / Standings / Settings).
3. **Repo persistence:** save/load league JSON to `elitesim-data` via the GitHub Contents API + a token wizard (Settings); localStorage working cache; friendlies stay ephemeral.
4. Then **Stage 4** (matchday content drop: batch videos + standings post + captions + calendar) to finish V1. **Commit at each stage boundary.**

## 🔗 Pointer
→ Current stage folder: `staging/stage-3-leagues-and-standings/`
→ Active feature file: `staging/stage-3-leagues-and-standings/feature-league-and-season-model.md`
