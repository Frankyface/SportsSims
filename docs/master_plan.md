# ESSPN / Crown League — Master Plan

_The complete vision, written so a brand-new session with zero prior context can rebuild the whole project. Last updated 2026-07-08._

> **Status: V1 shipped & LIVE** at frankyface.github.io/SportsSims (Soccer, the Crown League). Brand hierarchy: **ESSPN** is the fictional network (the broadcaster, wordmark E·SS·PN); the **Crown League** is the competition it shows. **Post-V1, the Soccer match engine was substantially upgraded** — from a ~30s cut-based "highlight reel" to **square-race-style CONTINUOUS PLAY** (~55-70s clips: flowing passes, a counting clock, a storyline commentator, real rules incl. red-card send-offs + corners, a full-frame stadium with rotating crowds + goal nets, and rotating real crowd audio with broadcast ducking). Post-V1 work lives in `staging/`. **Rugby** is fully built (union sim + league + content) but its *look* is **parked, not signed off**. **Golf — the SGA Tour** — is now **built, live & heavily iterated** (the first individual sport: group-play videos of both foursomes over all 9 holes, 10 procedural hole archetypes across 14 environments, a 14-event season rotating 10 of 20 venues + 4 majors, rankings + a career stats book); it is the active thread, awaiting real logos + operator look sign-off.

## Pitch

**ESSPN** — the *Elite Simulated Sports Programming Network* — is a fictional ESPN. A free web app simulates persistent, invented sports leagues and turns each match into a short (~55–70s), broadcast-styled **continuous-play** replay video for a faceless Instagram account. The launch competition is the **Crown League** — six hand-authored Soccer clubs with real crests. Rugby, Golf, then American Football, Basketball, and Hockey follow on the same engine as further ESSPN competitions.

## Problem & Why

Simulation/race videos (marble racing, *Marbula One*, Horse Race Tests, square-race sims) pull huge, devoted audiences. But almost all of them are **disposable** — a single clip with no continuity. The magic that actually builds a *fanbase* is what most of them under-use:

> **Recurring competitors you get attached to + a persistent seasonal standings race + "anyone can win" RNG drama.**

EliteSimSPN is built around that fandom engine from day one, and adds the one thing none of the marble accounts have: a **credible broadcast package** (scoreboard, lower-thirds, a real "network" identity). That's the differentiation — it makes a simple 2D sim feel like a sport people take seriously. (Jelle's Marble Runs' ESPN-grade presentation literally got it onto ESPN during the 2020 sports void.)

## Target users & use cases

- **Primary user = the operator (you).** A solo, non-coder creator running a faceless account. Jobs-to-be-done:
  1. **Sim a game** and get a finished, post-ready video with one click.
  2. **Run a league** — sim a whole matchday at once and get every game's video *plus* an updated-standings post, all ready to post.
  3. **Keep the world going** — standings, results, and history persist across sessions so the season race is real and editable.
- **Secondary users = the Instagram audience.** They never touch the app; they consume the videos and (later) a public standings page. Their job: pick a team, follow the race, argue in the comments.

## v1 scope — SHIPPED (Soccer / Crown League, free, on GitHub Pages)

- A **"Sim a Match" (Friendly) tab**: pick a matchup (or shuffle) → watch a stylized continuous-play match → nothing is saved. _(Post-V1: now a picker + a fresh result every run.)_
- The **Crown League: 6 clubs**, double round-robin (10 matchdays, 30 games) + **top-4 playoffs**; a **champion crowned**, then an **offseason** rolls ratings into the next season.
- **One click → an Instagram-ready MP4** — a big stylized pitch (recognizable match, ~8 players/side, goals emerge) with a broadcast overlay carrying the **real club crests + Crown League logo**, plus procedural audio.
- **Sim a whole matchday at once** → every game's video + a standings-update PNG + captions. **"Download Season Content"** zips the *whole season* (a video + an as-of standings post per game) with a `POSTING_ORDER.txt`.
- **Standings persist** to localStorage + an optional `elitesim-data` repo; **friendlies stay ephemeral**.
- Runs entirely on **GitHub Pages, for free.** You post by tapping "share" yourself (Rung 1).

### Explicit v1 non-goals
Rugby & Golf (fast-follows), named star players (data model keeps the slot; UI stays team-level), promotion/relegation across divisions (parked note), **any** auto-posting, any paid services/APIs.

## Future roadmap (6–12 months)

- **Multiply sports:** Rugby, then Golf (individual — foursomes, majors, season-long rankings), then American Football / Basketball / Hockey. _(Rugby (**Bastion Championships**) is fully built but its match *look* is parked. Golf (the **SGA Tour**) is built, live & **content-complete** — 8 golfers in two foursomes, a 20-course pool rotating 10-of-20 per season with 4 majors, a career stats book, group-play videos, a **one-click full-season content `.zip`** (by tournament → round, with **10-image course-preview carousels** + **rankings after every event**), live major crests, and a **"career day" boost**.)_ **→ With the content engine this deep, the active build has now turned to the automation ladder (auto-posting).**
- **Turn on star players:** ~4 named stars per team, scorers, streaks, rivalry- and persona-driven captions; a public standings/records page in the IG bio.
- **Automation ladder → the "self-running newsroom":** batch/queue (Rung 2) → scheduled auto-posting with one-tap approval via GitHub Actions + the official Instagram API (Rung 3) → fully hands-off, running to a real-sports-style calendar (Rung 4).
- **Possible later:** promotion/relegation across two divisions; a cross-sport shared universe (a team you love in Soccer shows up in Rugby); sport sub-accounts under the network brand (@EliteSimSPN → …Golf, …Rugby), ESPN-style.

## Tech stack & key decisions (with the why)

- **React + Vite + TypeScript**, static build → **GitHub Pages.** Free; the most AI-supported stack (matters because Claude maintains it on ~1hr/week of the user's time); TypeScript keeps it safe across sessions.
- **HTML5 Canvas** for the match — simple 2D tokens-on-a-pitch, easy to render deterministically and capture.
- **Deterministic seeded simulation** — a pure `simulateMatch(config) → MatchResult{score, events[]}` with a single PRNG (`xmur3`→`mulberry32`) as its only source of randomness. Same seed → identical match → identical video. This unlocks later server-side auto-rendering (Rung 4). **Non-negotiable; see determinism rules in `CLAUDE.md`.** Each new league uses a **random seed**, so every reset plays out differently.
- **Elo/Glicko-2 rating model** (`src/ratings/`) — starting ratings are a random draw (NOT tied to a club's archetype). Ratings **carry over season-to-season with a small offseason drift**; a "big offseason" raises a club's volatility. No regression to the mean — strength persists as a storyline.
- **Real club crests + the Crown League logo** (`src/assets/logos/`) render into the videos (scorebug/intro/result) and standings (table + PNG post) as circular badges; downscaled to ~512px and preloaded before render/export.
- **WebCodecs** (`VideoEncoder` + `mp4-muxer`) for in-browser export — produces a real Instagram-ready H.264/AAC MP4 with the moov atom up front, and needs **no** cross-origin-isolation headers (which GitHub Pages can't set). Frame-stepped (not real-time recorded) → exact 30fps. `ffmpeg.wasm` single-thread is the fallback only.
- **Persistence = JSON in a separate `elitesim-data` repo** via the GitHub Contents API, with a fine-grained single-repo token. localStorage is the instant working cache; the repo file is the durable, versioned source of truth. Separate repo = tiny token blast radius + saves don't rebuild the site.
- **Automation spine (later) = GitHub Actions** (free/unlimited on public repos, ffmpeg preinstalled) that re-renders the deterministic sim headlessly and posts via the Instagram API. Own-account posting stays in Meta "Standard Access" → **no App Review**.

The evidence and exact APIs/gotchas behind all of this: [`research-findings.md`](research-findings.md).

## Architecture sketch

```
┌─────────────────────────── GitHub Pages (free, static) ───────────────────────────┐
│  React + Vite + TS app                                                             │
│                                                                                    │
│   [Pure Sim]  simulateMatch(config, seed) ─► MatchResult { score, events[] }       │
│      │  (no DOM, no Math.random/Date.now, one PRNG, versioned)                      │
│      ▼                                                                              │
│   [Dumb Renderer]  (events, renderSeed, frameIndex) ─► Canvas frame                 │
│      │  broadcast overlay: scoreboard bug · lower-thirds · intro/result cards       │
│      ├──► live preview (watch in browser)                                           │
│      └──► WebCodecs frame-step ─► H.264/AAC ─► mp4-muxer ─► download .mp4 (Reel)    │
│                                                                                    │
│   [League state]  localStorage cache  ◄──►  GitHub Contents API                     │
└───────────────────────────────────────────────────────┬────────────────────────────┘
                                                         │ (write, fine-grained token)
                                              ┌──────────▼───────────┐
                                              │  elitesim-data repo   │  league-history.json
                                              └───────────────────────┘
   (Later, Rung 3/4) GitHub Actions ─ headless re-render of the SAME sim ─► IG Graph API
```

The **same sim + renderer** power the in-browser preview, the WebCodecs export, and (later) the headless Actions re-render. One engine, three uses — the reason determinism is sacred.

## Staged roadmap

_Stages 1–4 (v1) are **shipped & live**. Stage 3 shrank from 10 teams to the 6-club Crown League; the rating "reset" became the offseason carry-over model. Stages 5–7 are post-V1._

| # | Stage | Goal | Headline / definition of done | v1? |
|---|-------|------|------------------------------|-----|
| 1 | Foundation & de-risking slice | Stand up the app + prove the riskiest path | App auto-deploys to Pages; a **hardcoded deterministic match renders on Canvas and exports a 1080×1920 MP4** you post to @EliteSimSPN successfully | ✅ |
| 2 | Watchable soccer | Make the match genuinely fun to watch | Calibrated sim (drama, upsets, believable scores) + **broadcast overlay** + the **"Friendly" tab** → a dramatic, legible clip. _(Post-V1: upgraded to ~55-70s **continuous play** — see the status note at top.)_ | ✅ |
| 3 | Leagues & standings | Persistent seasons | 10-team season + playoffs; standings **persist to `elitesim-data`** across reloads/devices; friendlies stay ephemeral | ✅ |
| 4 | Matchday content drop | One click = a day's content | Batch-sim a matchday → all game videos + a **standings-update post + captions** on an **ESPN-style calendar** | ✅ **(v1 finish line)** |
| 5 | Rugby & Golf | Multiply the engine | Rugby (team) + Golf (foursomes, majors, season rankings) via the same pipeline. _Rugby: fully built, match **look parked**. Golf (**SGA Tour**): **built, live & content-complete** — group-play videos, 24 courses / 10-of-20 rotation, 4 majors, career stats book, one-click full-season `.zip` (course-preview carousels + per-event rankings), live major crests, "career day" boost; only the SGA network logo + look sign-off remain._ | Golf ✅ live |
| 6 | Star players & drama | Deepen fandom | ~4 named stars/team, scorers, streaks, rivalry/persona captions, public standings page | — |
| 7 | Automation ladder | The self-running newsroom | Rung 2 (batch/queue) → Rung 3 (scheduled auto-post + one-tap approval) → Rung 4 (hands-off) | **← ACTIVE next** |

## Open questions & risks

**Top risks (designing against them):**
- **Watchability** — a boring/samey sim kills fandom. Mitigation: an explicit "is this fun to watch?" gate in Stage 2; calibrate against real football stats; a momentum/comeback mechanic for late drama.
- **Scope creep** — 6 sports × video × automation. Mitigation: Soccer end-to-end (Stages 1–4) before anything multiplies; every sport reuses the same spine.
- **Determinism drift** — an accidental `Math.random`/`**` in the sim silently breaks later auto-rendering. Mitigation: the determinism rules + (planned) a lint check on the sim module.
- **Genre saturation** — marble/square races are crowded. Mitigation: our moat is the persistent league + broadcast narrative, not physics novelty.

**Open questions (revisit as we build):**
- Posting cadence: a real-sports calendar rhythm vs. a simple fixed 3×/week to start? (Research leans "start 3×/week at a fixed time, scale to daily.")
- Public vs private `elitesim-data` repo (public = free tokenless reads + fits a fan account; private = hidden but reads also need the token).
- Exact scoreline "personality" for the brand (grind-y 1–0s vs end-to-end thrillers) — a single sim tuning knob, but a creative call.

## Glossary

- **ESSPN** — the fictional network/broadcaster brand (wordmark E·SS·PN). **Crown League** — the Soccer competition ESSPN shows (6 clubs). **Bastion Championships** — the Rugby competition (6 clubs; identity + crests built, sim pending).
- **Offseason** — between seasons, each club's rating drifts a little (form + transfer-window noise); a "big offseason" raises its volatility. Ratings persist year to year (no reset to the mean).
- **Matchday / round** — one slate of league fixtures; the unit of a "content drop."
- **Friendly** — a one-off sim, not part of any league; produces a video but is never saved.
- **Deterministic sim** — same input seed always yields the same match and video.
- **Event timeline** — the ordered list of what happened in a match (kickoff, shots, goals, cards…); the renderer animates it and captions quote it.
- **Broadcast overlay / package** — the on-screen ESPN-style graphics: scoreboard bug, lower-thirds, intro "tale of the tape," result end-card.
- **Rung 1–4** — the automation ladder, from "you tap post" (1) to "fully hands-off newsroom" (4).
- **The linked list** — the doc model: `handoff.md` is the head (where we are), the `staging/` feature files are the body (ordered work).
