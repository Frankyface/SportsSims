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

The **match sim + overlay below are still the open work — this is now the active build.**

## Reference: mirror the (feature-complete) soccer engine
The soccer engine is the proven blueprint; the rugby build should follow the same shape with sport-specific swaps:
- **Sim** (`src/sim/simulateMatch.ts`): deterministic, one frozen RNG stream off a stable `seedKey`, records event timeline + possession/phase spans. Guard replay identity with a golden snapshot (`scoreCompat.test.ts` pattern) and calibrate with a Monte-Carlo test (`simulateMatch.test.ts`). Determinism hygiene: no `Math.random`/`Date.now`/transcendental math/`**` inside `src/sim/` (enforced by `determinism-hygiene.test.ts`).
- **Choreographer** (`src/sim/choreographer.ts` + `formation.ts`): expands spans into a continuous, unbroken ball/possession script on a SEPARATE cosmetic PRNG stream (`seedKey + ':pbp'`) so it never disturbs the score.
- **Director** (`src/render/director.ts`): lays the script on a render clock (counting game clock, live score keyframes, `moments` for overlays/audio, single-active-overlay priority).
- **Scene + overlay** (`src/render/renderScene.ts`, `renderMatch.ts`): pure `drawFrame(model, t)`; moving players, stadium crowd, goal/try areas, side-aware ducked audio (`src/export/audio.ts` + the `src/assets/audio/` drop-in bank).
- **Isolation:** keep everything rugby in `rugbyTeams.ts` / `rugbyLogos.ts` / `RugbyTab.tsx` + new rugby sim/render modules; NEVER touch the live soccer path.

## Acceptance criteria
- [ ] Deterministic rugby sim producing believable scores + an event timeline (tries, conversions, penalties, cards).
- [ ] Rugby overlay (scoreboard, event plates) in the network style.
- [~] Plugs into the existing league/season/standings/content-drop/calendar with no spine rewrite. _(Identity plugs in cleanly; the sim/overlay are the remaining plug points.)_
- [ ] Calibrated to realistic rugby scorelines.

## Open Questions
- **[GATE — decide first, with the operator]** Which rugby code (union/league) and typical score ranges to target? _(Crests are all "RFC" — union naming — so **union is the leaning**, but scoring/score-ranges are not yet locked. Lock this before building the sim.)_
- How much can the soccer possession-tick model be reused vs. a rugby-specific **phase** model? _(Leaning: a possession = a series of phases ending in a score attempt / turnover / penalty, analogous to the soccer possession tick — reuse the span→choreographer→director shape.)_
- Pitch/token representation differences for readability at phone size (posts + in-goal areas + 22m/10m lines; 15-a-side is a lot of dots — consider a readable subset).
- Crest backgrounds: Highmoor's grey-gradient bg + Bastion's flat-white bg need cleanup for on-pitch/overlay use (see handoff Deferred).
