# Feature — Deterministic sim core

## What
The pure, deterministic simulation foundation: the seeded PRNG and a first `simulateMatch(config)` that returns a `MatchResult { score, events[] }` for one hardcoded soccer match. No rich calibration yet (that's Stage 2) — just a correct, **replayable** engine and its data types.

## Why
This is the load-bearing bet of the whole project: same seed → identical match → identical video → later, identical headless re-render. Getting the architecture and determinism right now is what keeps Rung-4 automation reachable.

## Acceptance criteria
- [ ] `xmur3` + `mulberry32` PRNG implemented; a match seed derived from stable IDs.
- [ ] `simulateMatch(config, seed)` is a **pure function** — no DOM, no `Math.random`/`Date.now`/`performance.now`/rAF, no transcendental math (`exp/sin/log/pow`/`**`).
- [ ] Running the same seed twice yields a byte-identical `MatchResult` (a test asserts this).
- [ ] Types defined: `TeamRating`, `MatchConfig`, `MatchEvent`, `MatchStats`, `MatchResult`; every event carries `minute`, `type`, `scoreAfter`.
- [ ] `simVersion` constant stored on every result.
- [ ] A lint/check (even a simple grep test) forbids the banned APIs in `src/sim/`.

## Technical notes
See `docs/research-findings.md` §2 for the possession-tick model, PRNG code, and the determinism rules. Keep the event model rich enough to animate (shots with `shotXY`, goals, cards) even before tuning realism.

## Open Questions
- Team ratings for the hardcoded match: hand-pick two teams now; real roster generation is Stage 3.
- Stronger PRNG (`sfc32`/`splitmix32`) instead of `mulberry32`? Determinism is identical either way; `mulberry32` is fine unless calibration needs better distribution.
- Where does `simVersion` bumping get documented so old saved matches keep replaying correctly? (Decide a convention in Stage 3 when persistence lands.)
