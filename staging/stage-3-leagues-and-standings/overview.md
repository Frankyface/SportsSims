# Stage 3 — Leagues & standings

## Goal
Make the world persistent: a real 10-team Soccer league with a season, playoffs, a standings table, and history that **saves to the `elitesim-data` repo** and survives reloads and different devices. Friendlies stay ephemeral.

## Why this stage exists
The persistent standings race is the fandom engine (per research §5) — it's what turns disposable clips into a season-long story people follow. This stage builds the data model and persistence that everything downstream (content drops, star players, automation) reads from.

## Features in this stage
- `feature-league-and-season-model.md` — teams, fixtures, season lifecycle, playoffs, standings math.
- `feature-standings-ui.md` — the table + team pages, editable by the user.
- `feature-repo-persistence.md` — save/load JSON via the GitHub Contents API + the token wizard.

## Definition of done
- Create/seed a 10-team league; sim league games; the standings table updates correctly (pts, GD, form).
- League state **persists** to `elitesim-data` and reloads on a fresh browser/device.
- Season completes → playoffs → champion crowned → season archived to history → standings reset for the next season.
- The user can **edit/reset** standings and rosters (their explicit requirement).
- Friendlies never write to league data.

## Blocked by
Stage 2 complete; `help.md` items 2 & 3 (data repo + token).
