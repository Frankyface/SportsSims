# CLAUDE.md — Constant rules for every ESSPN / Crown League session

> Read this first, then **read `handoff.md`** (the single source of truth for where we are), then open the active feature file the handoff points to. Do not start work until you've done that.

## What this is

**ESSPN** ("Elite Simulated Sports Programming Network", wordmark **E·SS·PN**) is a fictional sports network — a free web app on GitHub Pages that simulates persistent fictional leagues and exports short (~30s) broadcast-styled replay videos for a faceless Instagram account. The launch competition is the **Crown League** (6 Soccer clubs with real crests); Rugby, Golf & more follow. The persistent standings race is the point — it's what turns one-off clips into fandom. **V1 is shipped & live** at frankyface.github.io/SportsSims.

## The person I'm working for (read this every time)

- **The user is a non-coder.** They never open a terminal, never edit code, never touch git. Their entire job is clicking buttons in the app and reviewing results.
- **Therefore I (Claude) do 100% of the technical work**: writing code, running builds/tests, all git operations (init/commit/push/branch), and deploys. When something genuinely can only be done by a human (creating a GitHub token, enabling Pages, IG/Meta account setup), it goes into `help.md` as a click-by-click checklist item — never assume the user can "just run" anything.
- **Design principle: least manual effort.** Every workflow should collapse toward *one click → finished result*. If a feature adds recurring manual steps for the user, flag it and find a lower-effort path.

## Tech stack & key decisions (with the why)

| Choice | Why |
|---|---|
| **React + Vite + TypeScript** | Most AI-supported stack, so I can maintain it fast on the user's ~1hr/week. TypeScript catches errors across sessions. |
| **Static build → GitHub Pages** | Free hosting; no server for v1. |
| **HTML5 Canvas** for the match | Simple 2D "tokens on a pitch," easy to render deterministically and capture to video. |
| **Deterministic seeded sim** (pure functions + one PRNG: `xmur3`→`mulberry32`) | Same seed → byte-identical match → identical video. This is the bet that makes later server-side auto-rendering (Rung 4) possible. **Do not break it.** |
| **WebCodecs** (`VideoEncoder` + `mp4-muxer`) for export | Produces true Instagram-ready H.264/AAC MP4 in-browser, needs no COOP/COEP headers (which Pages can't set). `ffmpeg.wasm` single-thread is the fallback only. |
| **League data = JSON in a *separate* `elitesim-data` repo** via GitHub Contents API | Free versioned "database"; separate repo keeps the save-token's blast radius tiny and avoids rebuilding the site on every save. |
| **Elo/Glicko-2 ratings, decoupled from archetype + offseason carry-over** (`src/ratings/`) | Random starting ratings per league (each reset differs); ratings persist season-to-season with a small offseason drift; a "big offseason" raises volatility; no regression to the mean. |
| **Real crests + Crown League logo** (`src/assets/logos/`, via `src/render/logos.ts`) | Drawn into videos + standings as circular badges; downscaled to ~512px and preloaded before render/export so nothing blocks. |

**Brand:** ESSPN is the network (broadcaster); the **Crown League** is the competition. Use "Crown League" for the competition/table, "ESSPN" for the network wordmark.

Full rationale and the evidence behind these: [`docs/research-findings.md`](docs/research-findings.md).

## Determinism hygiene (LOAD-BEARING — enforce in every sim change)

Inside the simulation module, **never** use: `Math.random`, `Date.now`, `performance.now`, `requestAnimationFrame` timing, or transcendental math (`Math.exp/sin/log/pow`, the `**` operator) — these diverge across browsers/Node and silently break replay identity. Use only `+ - * /`, comparisons, bit ops, and `Math.imul`; square with `x*x`, not `x**2`. All randomness comes from the single seeded PRNG. Store a `simVersion` with every saved match and freeze shipped sim versions.

## Coding conventions

- Small, focused files (aim 200–400 lines, 800 max). Organize by feature/domain. Extract utilities.
- Immutability: return new objects, don't mutate. Handle errors explicitly; validate at boundaries (tokens, saved JSON, external API responses).
- Keep the **pure sim** and the **renderer** in separate modules with no shared mutable state. The renderer is a pure function of `(events, renderSeed, frameIndex)`.
- Tests for new logic (sim math especially — Monte-Carlo calibration counts as a test). Aim 80% on core logic.
- Names: `camelCase` funcs/vars, `PascalCase` types/components, `UPPER_SNAKE_CASE` consts, `is/has/should` booleans.

## How to run / test (my job, not the user's)

- Dev: `npm install` then `npm run dev` (Vite). Verify changes in the preview before claiming done.
- Build: `npm run build` → `dist/`. Deploy is a GitHub Action to Pages (see Stage 1).
- Tests: `npm test` (Vitest). Stand this up in Stage 1, before any feature code.

## Verification & success states (how we know it works) — REQUIRED

**Test as we go.** Every feature is built against an explicit, checkable **success state**, and nothing is marked "done" until that state is *demonstrated* — not just coded. Reading code is not verification.

- **Success states = the feature file's Acceptance Criteria + the stage's Definition of Done.** Treat every checkbox as a test to pass or an action to observe.
- **Write the check first where practical** (TDD; honor the global testing standard — 80%+ on core logic, AAA structure). For the sim especially: a **determinism test** (same seed → byte-identical `MatchResult`) and a **Monte-Carlo calibration test** (10k matches hit the real football anchors) come with/before the sim code.
- **Pick the verification tool for the change:**
  - Logic (sim, standings, persistence) → Vitest unit tests + assertions.
  - UI / render → the preview tools (load the dev server, screenshot/inspect, read console + network) — never ask the user to eyeball it.
  - Video export → a smoke check: the produced MP4 has the right dimensions/codec/duration and actually plays / uploads as a Reel.
  - Deploy → after each deploy, confirm the **live** `*.github.io` URL loads (not just that the Action went green).
- **Report faithfully:** show the passing test / observed result / file inspection. Failing = say so, with the output.

Each stage `overview.md` lists its concrete **Success states** to verify against.

## Git & branching (I handle all of it)

- Repos: **code** → `Frankyface/SportsSims` (also serves Pages). **data** → `elitesim-data` (created by the user via `help.md`).
- Conventional commits: `feat: …`, `fix: …`, `refactor: …`, `docs: …`, `test: …`, `chore: …`. No AI-attribution lines in commits.
- Work on `main` for now (solo project); branch for anything risky. Commit in logical chunks, push when a step is done and verified.

## The documentation system — the linked-list model (keep it true)

- **`CLAUDE.md`** (this file) = the constant. Rarely changes.
- **`handoff.md`** = the **head of the linked list** — the single source of truth for "where are we right now." Read it first every session.
- **`staging/` feature files** = the linked list body — the ordered work, stage by stage. `handoff.md`'s pointer always names the current stage folder + active feature file.
- **`docs/master_plan.md`** = the whole vision, rebuildable from scratch. **`help.md`** = the human's to-do list. **`docs/research-findings.md`** = the evidence base.

## STANDING COMMAND — "update all relevant files"

When the user says **"update all relevant files"**, automatically, without asking a checklist:
1. Review what changed/was decided/built/failed this session.
2. Update as needed: **`handoff.md`** (always — every section + the pointer); `new_session_prompt.md` (if the resume pointer changed); this `CLAUDE.md` (only if a rule/convention/stack fact changed); the active **feature `.md`** files (tick done items, resolve/append open questions); the stage **`overview.md`** (if scope/done-criteria shifted); `docs/master_plan.md` (if the vision/roadmap genuinely changed); `help.md` (if new human to-dos appeared).
3. Keep linked-list integrity: the handoff pointer must point at the real current stage + active feature file.
4. Give the user a 3–5 line summary of what was updated and why.
