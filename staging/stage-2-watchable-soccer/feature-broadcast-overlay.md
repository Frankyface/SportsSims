# Feature — Broadcast overlay (the "ESPN" package)

## What
The on-screen broadcast graphics rendered on Canvas: a scoreboard "bug" (score + clock), lower-third name plates on goals/events, a pre-match "tale of the tape" intro card, a result end-card with the final score + a standings snippet, the @EliteSimSPN wordmark, and a basic audio bed (crowd loop + whistle/goal SFX).

## Why
This is the project's core differentiator — it's what makes a simple 2D sim read as a real *sport* and substitutes for the commentator a faceless account can't record. Research calls it load-bearing, not polish.

## Acceptance criteria
- [ ] Scoreboard bug always visible in the safe band (team colors, abbreviations, score, clock).
- [ ] Goal/card moments trigger a lower-third name plate + a visual flash + score bump.
- [ ] Intro card (~2s): matchup + records/form ("tale of the tape").
- [ ] Result card (~3s): final score + a one-line story + current standings snippet.
- [ ] Consistent typographic identity + original wordmark (no real logos/ESPN marks).
- [ ] Audio: crowd loop that swells on chances, whistle + goal SFX, mixed into the exported MP4.

## Technical notes
All overlay is deterministic drawing from `events[]`. Audio in the WebCodecs path = PCM → `AudioEncoder` (AAC) → mux. Keep everything same-origin. Respect IG safe zones (top ~220px, bottom ~400–450px).

## Open Questions
- Auto-generated "commentary" caption beats now, or in Stage 6 with the storyline engine? (Overlay text can start template-simple.)
- How much motion/particle flair before it hurts legibility on a phone? Err minimal.
- Music: royalty-free bed baked in, or leave audio to just crowd/SFX to avoid copyright issues on IG? (Lean crowd/SFX only for safety.)
