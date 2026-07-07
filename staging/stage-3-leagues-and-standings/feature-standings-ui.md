# Feature — Standings UI (table + team pages, editable)

## What
The in-app League/Standings screens: the live table, a per-team page (record, form, history), and the ability for the user to **edit or reset** standings and rosters at any time.

## Why
The user explicitly asked to reset/edit league standings whenever they want. It's also the operator's window into the season story they're telling.

## Acceptance criteria
- [ ] Standings table: position, team (color/crest), P/W/D/L, GF/GA/GD, Pts, last-5 form.
- [ ] Team page: season record, results, streaks, persona/rivalry notes.
- [ ] Edit mode: adjust points/results, rename/recolor teams, reset the season — with a confirm step and a save.
- [ ] Reflects the same JSON that drives the video overlays (one source of truth).
- [ ] Clear "unsaved changes" vs "saved to repo" indication.

## Technical notes
This screen reads/writes the same league state persisted in Stage 3's persistence feature. Editing must go through the same immutable-ID rules (renaming is fine; renumbering IDs is not).

## Open Questions
- Should manual edits be logged (an audit trail) so accidental resets are recoverable? (The repo's git history gives this for free.)
- Undo for edits, or rely on git history + "reload from repo"?
- How much of this should also appear on the *public* standings page (Stage 6) vs. stay operator-only?
