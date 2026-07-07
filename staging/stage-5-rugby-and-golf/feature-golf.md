# Feature — Golf

## What
Golf as an individual sport: fields of golfers playing in **heats of 4** with a live leaderboard, **majors** (premium events) layered on a season-long **rankings race**. Recurring golfer characters are the drama.

## Why
Validates the engine for an individual (non-team) sport and adds a distinct content format (leaderboard chase vs. head-to-head match).

## Acceptance criteria
- [ ] Deterministic golf sim: hole-by-hole scoring for a field, grouped into heats of 4, producing a leaderboard.
- [ ] Season structure: a Tour of events + Majors + a season-long points ranking.
- [ ] Golf overlay: leaderboard, hole/score, heat framing.
- [ ] Reuses persistence/standings (as rankings) + content-drop/calendar.
- [ ] Golfers are persistent named individuals with identity/color (fandom driver).

## Open Questions
- Video format: follow one heat of 4, a leaderboard-race edit across the field, or a hybrid? (Heats-of-4 was the user's instinct.)
- How to keep a golf clip dramatic in ~30s (final-hole focus? biggest movers?).
- Rankings model for the season (points per finish, major multipliers).
- Do golfers get the same "form-of-the-day"/upset mechanics as teams?
