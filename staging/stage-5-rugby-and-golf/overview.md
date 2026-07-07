# Stage 5 — Rugby & Golf

## Goal
Multiply the proven Soccer engine to two more sports: Rugby (another team sport) and Golf (individual — heats of 4, majors, season-long rankings). Same pipeline, sport-specific sim + overlay.

## Why this stage exists
Soccer end-to-end (Stages 1–4) proves the spine; this stage validates that the architecture is genuinely pluggable across sport types — including an individual sport, which stresses the "team-centric" assumptions.

## Features
- `feature-rugby.md` — rugby sim + overlay, reusing the league/persistence/content-drop spine.
- `feature-golf.md` — golf as heats of 4 + majors + season rankings (individual competitors).

## Definition of done
All three sports produce content (game videos + standings/leaderboard posts + captions) through the same batch/calendar workflow.

## Blocked by
Stages 1–4 complete (v1 shipped for Soccer).
