# Feature — League & season model

## What
The data model and logic for a league: teams (immutable IDs, name, colors, crest, ratings), a generated fixture list (home-and-away, 18 matchdays for 10 teams), season state, standings calculation, and end-of-season playoffs + champion + history archive.

## Why
This is the persistent structure the whole network runs on. Immutable team identity is the #1 fandom driver (research §5) — teams must persist across seasons so records and rivalries accrue.

## Acceptance criteria
- [ ] Team model with **immutable `id`**, name, city, primary color, 2-tone kit, crest, and `TeamRating`. A roster generator produces a believable 10-team league (fictional, original).
- [ ] Fixture generator: round-robin home-and-away → 18 matchdays; each fixture's seed derived from `leagueId:season:round:matchId` (reproducible).
- [ ] Standings: points (3/1/0), GD, GF, form; correct tie-breakers.
- [ ] Season lifecycle: regular season → **playoffs** → champion → archive season to history (past champions, final tables) → reset standings for a new season (teams persist).
- [ ] Data model reserves `playerIdx`/star-player slots (off in v1 UI) so Stage 6 needs no migration.
- [ ] Fandom fields present now: per-team persona line, rivalry pairs, streak/underdog tracking.

## Technical notes
Keep the league model pure/serializable (it's what gets saved as JSON). See research §2 (seeds) and §5 (fandom data model).

## Open Questions
- Playoff format: top-4 bracket? Top-2 final? (Pick something simple and dramatic.)
- Roster generation: fully seed-generated (zero effort) vs. some hand-authored flagship teams for narrative control? (Hybrid likely best.)
- How editable should ratings be by the user vs. auto-balanced? (User can edit; provide sensible defaults.)
- Season length feel: is 18 matchdays the right cadence for the posting schedule, or fewer games/faster seasons to reach climaxes sooner?
