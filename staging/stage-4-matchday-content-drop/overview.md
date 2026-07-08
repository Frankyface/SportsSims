# Stage 4 — Matchday content drop (v1 finish line)

> ✅ **Complete & shipped (V1 finish line).** One-click matchday pack (videos + standings PNG + captions) **plus** "Download Season Content" (whole season zipped in posting order with `POSTING_ORDER.txt`).

## Goal
One click on a calendar day → a whole matchday simulated at once → **every game's video + a standings-update post + written captions**, all organized and ready to post. This completes v1 (Rung 1: you tap "post").

## Why this stage exists
This is the operator's real daily workflow and the payoff of "least manual effort." It realizes the user's requirement: sim a league, get every game videoed (each different) plus an updated-standings post after the round.

## Features in this stage
- `feature-batch-sim.md` — simulate and render an entire matchday's games in one go.
- `feature-standings-post-and-captions.md` — the after-round standings graphic + auto-generated captions with a prediction hook.
- `feature-season-calendar.md` — the ESPN-style schedule mapping fixtures to post dates.

## Definition of done
- Pick a matchday (or "today" on the calendar) → the app sims all its games, renders each to an IG-ready MP4 (visually varied), generates a standings-update post, and writes a caption per asset.
- Everything lands in one organized place the user can grab and post.
- Results persist to `elitesim-data`; standings update accordingly.
- **After this stage, the Soccer product is fully shippable end-to-end.**

## Blocked by
Stage 3 complete.
