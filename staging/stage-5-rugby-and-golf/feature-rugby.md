# Feature — Rugby

## What
A rugby sim + broadcast overlay reusing the team/league/persistence/content-drop spine, with rugby-appropriate scoring (tries/conversions/penalties) and a fitting stylized 2D representation.

## Why
Second team sport; validates the engine generalizes with mostly sport-specific sim + overlay swaps.

## Progress (2026-07-08) — identity layer built ahead of the sim
The **club/league identity** now exists so the clubs are real (fandom driver) before the engine:
- [x] **6 rugby clubs** with full identity (`src/ratings/rugbyTeams.ts`) reusing the football `ClubDef` shape; `generateRugbyLeague` mirrors the soccer generator (random-draw ratings).
- [x] The competition — the **Bastion Championships** — named + branded (`RUGBY_LEAGUE`).
- [x] **Real crests + the Bastion logo** downscaled to 512px, wired via an **isolated** `src/render/rugbyLogos.ts` (soccer path untouched).
- [x] Read-only **Rugby club-book tab** (`src/ui/RugbyTab.tsx`) — the clubs are viewable in the app now.

The **match sim + overlay below are still the open work.**

## Acceptance criteria
- [ ] Deterministic rugby sim producing believable scores + an event timeline (tries, conversions, penalties, cards).
- [ ] Rugby overlay (scoreboard, event plates) in the network style.
- [~] Plugs into the existing league/season/standings/content-drop/calendar with no spine rewrite. _(Identity plugs in cleanly; the sim/overlay are the remaining plug points.)_
- [ ] Calibrated to realistic rugby scorelines.

## Open Questions
- Which rugby code (union/league) and typical score ranges to target? _(Crests are all "RFC" — union naming — so **union is the leaning**, but scoring/score-ranges are not yet locked. Decide before building the sim.)_
- How much can the soccer possession-tick model be reused vs. a rugby-specific phase model?
- Pitch/token representation differences for readability at phone size.
- Crest backgrounds: Highmoor's grey-gradient bg + Bastion's flat-white bg need cleanup for on-pitch/overlay use (see handoff Deferred).
