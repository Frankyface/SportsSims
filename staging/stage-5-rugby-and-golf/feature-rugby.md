# Feature — Rugby

## What
A rugby sim + broadcast overlay reusing the team/league/persistence/content-drop spine, with rugby-appropriate scoring (tries/conversions/penalties) and a fitting stylized 2D representation.

## Why
Second team sport; validates the engine generalizes with mostly sport-specific sim + overlay swaps.

## Progress (2026-07-08, later session) — THE MATCH ENGINE IS BUILT (union)
The operator locked **rugby union**. The full engine shipped in one pass, every module an
isolated mirror of its soccer counterpart (zero soccer files modified):
- [x] **Deterministic union sim** — `src/sim/rugbySim.ts` + `rugbyTypes.ts` (`RUGBY_SIM_VERSION 1`,
  frozen stream + golden snapshot). Tries/conversions/penalties (posts-or-corner choice)/drop
  goals/sin-bins/reds. Calibrated: ~50.5 pts, ~5.8 tries, 74.8% conv, 2.1% draws (N=3000);
  red card = +14pt loss-rate swing (N=6000).
- [x] **Choreographer** — `src/sim/rugbyChoreographer.ts` + `rugbyFormation.ts` (10 dots/side).
  Carry→ruck→backward-pass phases, kick tennis, corner lineout mauls, tee routines,
  conversions folded into try passages. Passes machine-verifiably never travel forward.
- [x] **Renderer/overlay** — `rugbyDirector/rugbyStoryline/rugbyScene/rugbyRenderMatch.ts`:
  80' clock, dual score-steps (grounding + conversion), context try labels, rugby captions,
  in-goal pitch + H posts, flat defensive line + ruck pile-ins, sin-bin walk-off/return,
  TRY! flash, Bastion intro/result cards. Anti-teleport + runtime-band + layout gates green.
- [x] **Export** — `src/export/exportRugbyMp4.ts` (WebCodecs + shared audio mixer via a
  moment-kind adapter). Browser smoke: 81MB video/mp4.
- [x] **Rugby tab** — friendly flow (pickers/shuffle/new match) + live preview + export;
  club book below. Zero console errors in verification.
- Tests: 47 rugby suites alongside the untouched 79 soccer tests (126 total green).

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
- [x] Deterministic rugby sim producing believable scores + an event timeline (tries, conversions, penalties, cards). _(rugbySim.ts, golden-frozen v1.)_
- [x] Rugby overlay (scoreboard, event plates) in the network style. _(80' clock chip, try/conversion/pen lower thirds, TRY! flash, Bastion cards.)_
- [x] Plugs into the existing league/season/standings/content-drop/calendar with no spine rewrite. _(DONE same-day v2: `league/rugbyLeague.ts` — union bonus-point standings (4/2/0, +1 four-try, +1 losing-within-7), top-4 playoffs, offseason, persistence; `RugbyLeagueTab` with round packs + tap-to-watch; tabs restructured to Soccer | Rugby | Settings. Season-zip download is the one deferred piece.)_
- [x] Calibrated to realistic rugby scorelines. _(Monte-Carlo N=3000: ~50.5 pts, ~5.8 tries, 74.8% conversions, ~4.1 pen goals, 2.1% draws.)_

## Open Questions
- ~~[GATE] union vs league~~ — **RESOLVED 2026-07-08: the operator locked UNION.** Calibration anchors used: ~47-52 total points, ~5-6 tries, ~75% conversions, ~4 penalty goals, drop goals rare, draws ~2%.
- ~~Possession-tick vs phase model~~ — **RESOLVED:** possession = a series of phases (avg ~45s) resolving to try/penalty/break/drop/turnover; the span→choreographer→director shape carried over exactly as hoped.
- ~~Readability at phone size~~ — **RESOLVED:** 10 dots/side (fullback + 5-man pack + 4-man backline); in-goals + H posts + 22m/10m lines all read cleanly at 1080x1920.
- **[NEW GATE — for league mode, with the operator]** Union standings points: 4 win / 2 draw / 0 loss, +1 four-try bonus, +1 losing-within-7 bonus is the real-world convention — confirm before building rugby standings.
- Crest backgrounds: Highmoor's grey-gradient bg + Bastion's flat-white bg need cleanup for on-pitch/overlay use (see handoff Deferred).
