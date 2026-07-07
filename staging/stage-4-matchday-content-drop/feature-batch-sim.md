# Feature — Batch matchday sim & render

## What
Simulate an entire matchday's fixtures at once and render each game to an Instagram-ready MP4, with enough visual variety that the feed doesn't look repetitive. No live watching required (the user said league sims don't need live replay).

## Why
The core "least manual effort" workflow: a round of content produced from a single action.

## Acceptance criteria
- [ ] "Sim matchday" runs all fixtures for that round (deterministic seeds), updates standings, and persists results.
- [ ] Each game renders to its own IG-ready MP4 via the Stage 1/2 export pipeline.
- [ ] **Visual variety** between clips (e.g. varied intro framing, camera/among presets, color-led theming per matchup) so posts feel distinct.
- [ ] Progress UI for the batch (N of M rendered); robust to a single game failing (others still complete).
- [ ] Outputs organized per matchday (folder/zip or an in-app gallery) with clear labels.

## Technical notes
Rendering many videos client-side is CPU-heavy but fine at league scale (5 games/round). Consider rendering sequentially with progress; WebCodecs is fast (~10× real-time). This exact batch logic is what the Stage 7 GitHub Actions spine will later run headlessly.

## Open Questions
- How many "look" variants are enough to feel fresh without huge build cost? (A handful of overlay themes may suffice.)
- Delivery: download a zip, save individual files, or an in-app gallery the user posts from? (Least effort → in-app gallery + one-tap download each.)
- Do we render all 5 games, or let the user pick which matchups to post? (Probably all, but allow skipping.)
