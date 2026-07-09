# Feature — Golf ⛳ THE SGA TOUR — BUILT, LIVE & CONTENT-COMPLETE (2026-07-09)

## What
Golf as an individual sport: **the SGA Tour** (Simulated Golf Association) — 8 persistent golfer
characters in two foursomes, 14-event seasons (10 rotating tournaments + **4 majors**, the Pinnacle
Championship closing the year), 4 rounds per event, 9 holes per round. Every round produces **TWO
videos — one per foursome — showing all four golfers play ALL 9 holes together, every shot** — plus a
full-field leaderboard card. A career stats book drives the storylines.

## Why
Validates the engine for an individual (non-team) sport and adds a distinct content format
(leaderboard chase vs. head-to-head match).

## Acceptance criteria
- [x] Deterministic shot-by-shot sim for a field of 8 in two groups of 4 → a leaderboard.
      (`sim/golfSim.ts`, **GOLF_SIM_VERSION 3**, golden + Monte-Carlo + parity + "having a day" tests.)
- [x] Season: 14 events (4 majors, finale = championship) + season points ranking (majors ×2), with
      **10-of-20 tournament venue rotation per season** (`league/golfSeason.ts`, `seasonSchedule`).
- [x] Group-play overlay: leaderboard, hole/score scorebug, group scoreboard, per-shot ball flights,
      deep green-zoom for putting. Both foursomes rendered per round.
- [x] Reuses persistence (localStorage `elitesim:golfseason:sga-tour`) + content-drop (event pack:
      (2 videos + leaderboard) × 4 rounds + rankings PNG) + the shared WebCodecs/audio export pipeline.
- [x] Golfers are persistent named individuals with identity/colour (`ratings/golfers.ts`).
- [x] Realism pass: visible water drops, short bunker shots, higher rough variance (v2).
- [x] 10 distinct hole-shape archetypes + per-theme "aliveness" (cliffs rock edge, forest big trees,
      water shimmer, one-map island green) across 14 environments / 24 courses.
- [x] SGA Tour branding (crest on intro + rankings cards, drawn fallback + `public/logos/sga.png` loader).
- [x] Majors book: character write-ups + crest art direction, in a Golf → Majors sub-tab.
- [x] **Full-season download** (`content/golfSeasonContent.ts`): one `.zip` organised **by tournament → round** — a Tuesday **course-preview carousel**, Rounds 1–4 (both group videos + that round's leaderboard), and the **updated season rankings after every event**; final table at root; `POSTING_ORDER.txt` walks it. `simGolfSeasonToEnd()` drives the one click.
- [x] **Course preview** — a **10-image carousel** (title card + all 9 holes as stills, reusing the real hole art) per event (`render/golfCoursePreview.ts`); shown in-app as a slideshow + a "⬇ Download 10 images (.zip)" button (`ui/GolfPreviewView.tsx`). Operator chose images over a video.
- [x] **Rankings after every event** — `golfRankingsSnapshot()` renders point-in-time standings (sliced events, cumulative points).
- [x] **"A guy having a day"** — each round a 9% chance one of the field's four weakest golfers (by skill) gets a temporary +75-rating (+0.25 skill) boost for that round only (**GOLF_SIM_VERSION 3**, `:day` sub-stream, `hotHand` on the result).
- [x] **4 major logos LIVE** — `public/logos/{evergreen-invitational,saltmarsh-open,redrock-classic,pinnacle-championship}.png`, painted on the course-preview title cards, round intros, and the Majors-book crests (`render/golfEventLogos.ts` + `golfEventLogoUrl()`).
- [ ] **SGA network logo** — `public/logos/sga.png` (drawn shield fallback live until dropped).
- [ ] **Operator look sign-off** on the LIVE site (Majors crests confirmed on-screen this session; still want an eyeball of the round videos).

## Decisions locked (operator)
- 8 golfers / two foursomes; rounds 2-4 regroup by leaderboard, leaders out last.
- **Format: every round = TWO videos (one per foursome), all 9 holes, EVERY shot, real golf order**
  (honours off the tee, then farthest-from-the-pin first; water balls splash then take the drop).
  Drama-weighted shot durations → 60-88s per group video (test-locked over 200 seeds × 2 groups).
- **Zoom:** ~3.2× green-zoom that fires when the whole group is *around* the green (greenside chips,
  not just putts); slower rolling putts; players' colour dots pushed OFF the pin (balls stay put);
  the **cup is drawn under the balls, the flag over them** (balls sit above the hole).
- **20-course rotation:** 4 majors on fixed signature courses + 10 tournaments rotated from a pool of
  20 each season, deterministic from (tour seed, season).
- **Ratings tightened for parity** (`generateGolfTour` spread 120→66): the field starts near-even so
  anyone can win a week; Glicko still lets a hot streak separate a golfer over a season.
- Glicko-2 per event via pairwise finishes (skill random per save, never tied to archetype; clutch
  temperament drawn) + career book (wins, majors, droughts, blown 54-hole leads, comebacks,
  wire-to-wire) feeding deterministic storyline chips + captions.

## The four majors (branding + write-ups)
Character write-ups live on the major event defs in `ratings/golfCourses.ts` (`description`) and show
in the **Golf → Majors** tab. Logo art direction is in the same file's `logo` fields.
1. **The Evergreen Invitational** — Verdant Hollow (forest). Green #1b5e20 + gold #caa64a. Old-money springtime, the shot-shaper's major.
2. **The Saltmarsh Open** — Saltmarsh Links (links). Navy #0d3b66 + sand #e3d5b3. The oldest, rawest, wind-decides-it trophy.
3. **The Redrock Classic** — Redrock Mesa (canyon). Terracotta #b3541e + copper #ffd9a0. Desert Americana, rewards the fearless.
4. **The Pinnacle Championship** — Pinnacle Head (cliffs), THE finale. Black #14141a + gold #d4af37. Crown jewel, belongs to the closer.

## Open questions / follow-ups
- Real **SGA network logo** (`public/logos/sga.png`) — drawn shield fallback live until then. _(The 4 **major** logos are ✅ live.)_
- Operator **look sign-off** on the LIVE golf round videos.
- Possible polish: putts even slower/tenser on the final hole of round 4; a visible on-screen **"🔥 career day" callout** for the boosted golfer (`hotHand` is already exposed on the round result — left off the render to avoid a concurrent edit).
- ✅ Golf **season-zip download** — DONE this session (`content/golfSeasonContent.ts`). Rugby's still isn't built.
