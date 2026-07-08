# Feature — Golf ⛳ THE APEX TOUR — BUILT (2026-07-08), awaiting operator sign-off

## What
Golf as an individual sport: **The Apex Tour** — 8 persistent golfer characters in two foursomes,
14-event seasons (10 tournaments + **4 majors**, the Pinnacle Championship closing the year as the
championship), 4 rounds per event, 9 holes per round, ~60s round videos with a live leaderboard,
and a **career stats book** driving storylines.

## Why
Validates the engine for an individual (non-team) sport and adds a distinct content format
(leaderboard chase vs. head-to-head match).

## Acceptance criteria
- [x] Deterministic golf sim: shot-by-shot, hole-by-hole scoring for a field of 8 in two groups of
      4, producing a leaderboard. (`sim/golfSim.ts`, GOLF_SIM_VERSION 1, golden + Monte-Carlo.)
- [x] Season structure: 14 events (4 majors, finale = championship) + a season-long points ranking
      (majors pay double). (`league/golfSeason.ts`.)
- [x] Golf overlay: leaderboard rail, hole/score scorebug, hole chapters, featured ball flights.
- [x] Reuses persistence (localStorage `elitesim:golfseason:`) + content-drop (event pack: 4 round
      videos + rankings PNG + captions) + the shared WebCodecs/audio export pipeline.
- [x] Golfers are persistent named individuals with identity/colour (`ratings/golfers.ts`).
- [ ] **Operator sign-off on the look** (eyeball the live preview / an exported reel).
- [ ] Real logos: 4 major marks + the Apex Tour mark (art direction written in
      `ratings/golfCourses.ts` `logo` fields + `golfers.ts` GOLF_TOUR.logo). Colour-chip fallbacks
      render everywhere until then.

## Decisions locked (operator, 2026-07-08)
- 8 golfers / two foursomes; rounds 2-4 regroup by leaderboard, leaders out last.
- **FORMAT v2 (operator, same day): every round = TWO videos — one per foursome — showing the
  whole group playing ALL 9 holes together, EVERY shot, one at a time (real golf order: honours
  off the tee, then farthest from the pin plays first), plus the full-field LEADERBOARD CARD
  after the round.** Shot durations are drama-weighted and scaled so each group video lands in a
  60-88s band (test-locked over 200 seeds × 2 groups). The original 9/6/3-hole highlight-edit
  director was replaced by this group-play director.
- Every course has a distinct environment (14 total: coast, alpine, lakeside, forest, heath,
  desert, parkland, links, tropical, quarry, canyon, moor, frost, cliffs) — procedural hole art.
- Stats system: Glicko-2 via pairwise finishes per event (skill random per save, never tied to
  archetype; clutch temperament also drawn) + career book (wins, majors, droughts, blown 54-hole
  leads, comebacks, wire-to-wire) feeding deterministic storyline chips + captions.

## The four majors (branding for logo generation)
1. **The Evergreen Invitational** — Verdant Hollow (forest). Forest green #1b5e20 + gold #caa64a.
2. **The Saltmarsh Open** — Saltmarsh Links (links). Navy #0d3b66 + sand #e3d5b3.
3. **The Redrock Classic** — Redrock Mesa (canyon). Terracotta #b3541e + copper #ffd9a0.
4. **The Pinnacle Championship** — Pinnacle Head (cliffs), THE season finale. Black #14141a + gold #d4af37.
Full art-direction prompts live in `src/ratings/golfCourses.ts` (`logo` fields).

## Open questions / follow-ups
- Drop-in logo loader (mirror `rugbyLogos.ts`) once the operator delivers PNGs.
- Season-zip download for golf (mirrors `content/seasonContent.ts`) — not yet built (rugby's isn't either).
- Possible polish: putts could read even slower/tenser on the final hole of round 4.
