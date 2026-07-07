# Handoff — EliteSimSPN
_Last updated: 2026-07-07 · Current stage: Stage 1 — Foundation & de-risking slice (in progress)_

## 🎯 Goals
Prove the riskiest path end-to-end: seed → deterministic soccer match → render → Instagram-ready MP4, live on GitHub Pages. The sim engine + scaffold are **done and verified**; the Canvas animation and WebCodecs export are what remain.

## 📍 Current State
- **Kickoff + planning complete.** Vision, v1 scope, tech stack, 7-stage roadmap in [`docs/master_plan.md`](docs/master_plan.md); feasibility GO verdict + evidence in [`docs/research-findings.md`](docs/research-findings.md).
- **Scaffold + app pushed** to `github.com/Frankyface/SportsSims` (`main`, latest commit `f9ae6d2`).
- **App builds & runs.** React + Vite + TS; `npm run dev`, `npm run build`, and `npm test` all pass. Deploy workflow (`.github/workflows/deploy.yml`) added (tests → build → Pages).
- **Deterministic sim engine done + verified.** `src/sim/` — `prng.ts` (xmur3→mulberry32), `types.ts`, `simulateMatch.ts` (possession / xG / momentum model). **9 tests pass:** determinism (same seed → byte-identical), shape/consistency, Monte-Carlo calibration (avgGoals 2.85, shots 25.7/game, draws 24% — realistic), and a banned-API hygiene guard.
- **Rating model added + verified.** `src/ratings/` — Glicko-2 (`glicko2.ts`), league generation with randomized starting Elo/RD/volatility (`teams.ts`), Glicko→playing-strength bridge (`strength.ts`). Match strength now derives from Elo; per-match form variance (from RD) drives upsets.
- **Verified live in the browser** (preview on :5199): renders a real match (e.g. CAR 4–1 KAN, goal-by-goal feed, true xG 1.68–1.08). Currently a **text feed** — the Canvas animation replaces it next.
- **Not yet done:** Canvas "tokens on a pitch" animation, WebCodecs MP4 export, live Pages deploy (blocked on the user enabling Pages).

## 📂 Files I'm Working On
- `src/sim/*` — sim engine (done). `src/App.tsx` — temporary text render (to be replaced by the Canvas renderer).
- Next: `src/render/` (Canvas match renderer) + `src/export/` (WebCodecs MP4).

## ✅ Things I've Changed (newest first)
- Added the **Elo/Glicko-2 rating model** (`src/ratings/`): randomized starting rating/RD/volatility, Glicko→strength bridge, season decay. Verified — Glicko matches the published example; season sim gives **correlation 0.67, upset rate 28%, top-seed title rate 45%** (clear good/bad teams, real upsets, not a coin flip). **15 tests pass.**
- Built + verified Stage 1 core: React/Vite/TS scaffold, deploy workflow, deterministic sim engine. Committed `f9ae6d2`, pushed.
- Fixed the xG model to be **true expected-goals** (was a proxy reading ~2.5× high); recalibrated shots to ~13/team. Verified by test + live preview.
- Added a verification & success-states discipline to `CLAUDE.md` + each stage.
- Scaffolded the full documentation system; ran the feasibility research pass (GO); pushed the docs (`47395e5`).

## ❌ Tried But Failed
- `MediaRecorder`-emits-MP4 — avoided by design (WebCodecs instead). Transcendental math in the sim — banned + guarded by a test.
- Preview needed an **8.3 short path** in launch.json (spaces break the npm spawn) **and** `server.fs.strict:false` in `vite.config.ts` (short-path vs Vite's serve allow-list). Both resolved.

## ➡️ Next Up
1. **Human unblock (1 click):** user enables GitHub Pages — [`help.md`](help.md) item 1 — so auto-deploy goes live. (The deploy Action builds+tests fine but its final publish step waits on this.)
2. Build the **Canvas match renderer** — stylized "tokens on a pitch" animation of the event timeline (stylized ② look, simu.lation2d-ish geometry) with the non-linear highlight edit + broadcast scorebug. → `feature-canvas-renderer-and-export.md`.
3. Build the **WebCodecs MP4 export** (frame-step → H.264/AAC → mp4-muxer → download; verify dimensions/codec + a real IG post).
4. End-to-end proof: user posts an exported clip to @EliteSimSPN.

## 🔗 Pointer
→ Current stage folder: `staging/stage-1-foundation-and-slice/`
→ Active feature file: `staging/stage-1-foundation-and-slice/feature-canvas-renderer-and-export.md`
