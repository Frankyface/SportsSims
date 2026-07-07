# Feature — Star players

## What
Enable ~4 named star players per team: names, a position, a finishing/persona attribute, and per-player stats (goals/streaks). Wire them into sim events (scorer callouts), overlays (lower-thirds), and captions.

## Why
Two-tier identity (named teams + named players) roughly doubles the storylines from the same match and is a proven fandom multiplier.

## Acceptance criteria
- [ ] Player model attached to teams via the reserved `playerIdx` (no data migration needed).
- [ ] Sim assigns scorers/key events to players deterministically.
- [ ] Overlays and captions name the scorer / man-of-the-match.
- [ ] Per-player season stats tracked and persisted.
- [ ] Star players optional/toggleable per sport.

## Open Questions
- Extend to all 6 sports or just team sports? (Golf is already individual.)
- Hand-authored star personas vs. generated? (Hybrid: authored personas + generated match beats.)
- How many players deep before it's clutter — keep to ~4 stars/team as the user suggested?
