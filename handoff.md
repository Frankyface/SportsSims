# Handoff — EliteSimSPN
_Last updated: 2026-07-07 · Current stage: Stage 1 — Foundation & de-risking slice (not started)_

## 🎯 Goals
Stand up the project and prove the single riskiest thing end-to-end: **seed → deterministic soccer match → Canvas render → WebCodecs MP4 download**, live on GitHub Pages, and confirm the file actually posts as an Instagram Reel. Everything else builds on this slice.

## 📍 Current State
- Planning + kickoff **complete**. Full interview done; vision, v1 scope, tech stack, and 7-stage roadmap decided and written up in [`docs/master_plan.md`](docs/master_plan.md).
- **Feasibility verified** (background research, GO verdict) — see [`docs/research-findings.md`](docs/research-findings.md). Key upgrades locked: WebCodecs export (no header issues on Pages), own-account IG posting skips App Review, league data in a separate `elitesim-data` repo.
- Repo initialized locally on `main`, remote → `github.com/Frankyface/SportsSims` (confirmed empty). **No app code written yet.**
- **Nothing is built.** No React app, no sim, no deploy pipeline yet.

## 📂 Files I'm Working On
- Documentation scaffold (this handoff, `CLAUDE.md`, `docs/`, `staging/`) — just created.
- Next code target: `staging/stage-1-foundation-and-slice/` feature files.

## ✅ Things I've Changed (newest first)
- Scaffolded the full documentation system (CLAUDE.md, handoff, new_session_prompt, help, master_plan, research-findings, 7 staging stages).
- Ran a 5-topic feasibility research pass → GO verdict; folded findings into the plan.
- `git init` on `main` + added the GitHub remote.

## ❌ Tried But Failed
- _(nothing yet)_ — Known trap to avoid (from research): do **not** rely on `MediaRecorder` to emit MP4 (breaks silently across machines) — use WebCodecs. Do **not** use transcendental math in the sim (breaks determinism).

## ➡️ Next Up
1. **Human unblock:** user completes the Stage-1 items in [`help.md`](help.md) — create the `elitesim-data` repo + a fine-grained token, and enable GitHub Pages on `SportsSims`.
2. Scaffold the React + Vite + TypeScript app; get an auto-deploy-to-Pages GitHub Action working (a "hello world" live on the `*.github.io` URL).
3. Build the two-layer core: a pure deterministic `simulateMatch(config)` + a dumb Canvas renderer, on ONE hardcoded match.
4. Add WebCodecs export → download a 1080×1920 MP4; user manually posts it to @EliteSimSPN to confirm the pipeline.

## 🔗 Pointer
→ Current stage folder: `staging/stage-1-foundation-and-slice/`
→ Active feature file: `staging/stage-1-foundation-and-slice/feature-project-setup-and-deploy.md`
