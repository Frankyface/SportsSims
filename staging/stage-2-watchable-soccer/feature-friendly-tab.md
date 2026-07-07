# Feature — "Sim a Match" (Friendly) tab

## What
A sandbox tab where the user picks or auto-generates two teams, sims a one-off match, watches it, and exports the video. **Nothing is saved** — friendlies never touch league data.

## Why
The user explicitly wanted a "see how it works" mode. It's also the fastest way to test the sim/overlay/export loop without league setup, and a natural place to demo the product.

## Acceptance criteria
- [ ] Tab lets the user choose two teams (generic/sample teams are fine — no league roster required) or hit "random matchup."
- [ ] "Sim" runs the deterministic match; the user can watch the preview.
- [ ] "Export" produces the Instagram-ready MP4 (reuses Stage 1/2 export).
- [ ] Explicit "not saved" affordance — no standings, no history writes.
- [ ] Optional: a "re-roll" that sims a fresh seed for a different result.

## Technical notes
Generic teams can be a small built-in set with colors/names. Shares 100% of the sim + render + export code with league play — this tab is just a thin UI over a single-match run.

## Open Questions
- Should the user be able to tweak team ratings in the friendly tab (slider sandbox), or keep it fixed? (Fun, but optional — defer unless easy.)
- Save a friendly *optionally* if the user loves the result? (Default no; could add an "export only" vs "promote to league" later — probably out of scope.)
