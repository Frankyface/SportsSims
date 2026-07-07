# Feature — Rugby

## What
A rugby sim + broadcast overlay reusing the team/league/persistence/content-drop spine, with rugby-appropriate scoring (tries/conversions/penalties) and a fitting stylized 2D representation.

## Why
Second team sport; validates the engine generalizes with mostly sport-specific sim + overlay swaps.

## Acceptance criteria
- [ ] Deterministic rugby sim producing believable scores + an event timeline (tries, conversions, penalties, cards).
- [ ] Rugby overlay (scoreboard, event plates) in the network style.
- [ ] Plugs into the existing league/season/standings/content-drop/calendar with no spine rewrite.
- [ ] Calibrated to realistic rugby scorelines.

## Open Questions
- Which rugby code (union/league) and typical score ranges to target?
- How much can the soccer possession-tick model be reused vs. a rugby-specific phase model?
- Pitch/token representation differences for readability at phone size.
