# Stage 5 — Rugby & Golf

## Goal
Multiply the proven Soccer engine to two more sports: Rugby (another team sport) and Golf (individual — heats of 4, majors, season-long rankings). Same pipeline, sport-specific sim + overlay.

## Why this stage exists
Soccer end-to-end (Stages 1–4) proves the spine; this stage validates that the architecture is genuinely pluggable across sport types — including an individual sport, which stresses the "team-centric" assumptions.

## Features
- `feature-rugby.md` — rugby sim + overlay, reusing the league/persistence/content-drop spine.
- `feature-golf.md` — golf as heats of 4 + majors + season rankings (individual competitors).

## Progress (2026-07-08)
**Rugby** is fully built AND league-integrated (union sim → choreographer → renderer → MP4 export → Bastion league mode + content packs; all live) — but the operator says the match still doesn't *look* like rugby after three realism passes, so it is **PARKED, not signed off** (revisit the 2D representation, not more constant-tuning). **Golf (the SGA Tour)** is now **BUILT, LIVE & heavily iterated** — the first individual sport, done end-to-end in isolated modules: group-play videos (both foursomes, every shot, all 9 holes), a deterministic sim (GOLF_SIM_VERSION 2) with realism, 10 procedural hole archetypes across 14 environments, a 14-event season that rotates 10 of 20 tournament venues + 4 majors, rankings + Glicko + a career stats book, SGA branding + a Majors book, and event content packs. Remaining: real logos + operator look sign-off. See `feature-golf.md` (active) + `feature-rugby.md` (parked).

## Definition of done
All three sports produce content (game videos + standings/leaderboard posts + captions) through the same batch/calendar workflow. **Soccer ✅ · Golf ✅ (awaiting look sign-off) · Rugby ✅ engine, ⚠️ look parked.**

## Blocked by
Stages 1–4 complete (v1 shipped for Soccer).
