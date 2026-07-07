# Feature — Public standings page

## What
A public page on the GitHub Pages site showing the live league table, per-team and per-player records, and head-to-head history — a home for fans between video drops. Linked in the @EliteSimSPN bio.

## Why
Mature marble/race fandoms build their own stat wikis/sheets; giving fans a place to "live" and argue between posts deepens retention (research §5, P1).

## Acceptance criteria
- [ ] Reads the same `elitesim-data` JSON (public repo → tokenless read) — one source of truth.
- [ ] Live standings, team pages, player leaderboards, past champions/records.
- [ ] Mobile-friendly, on-brand, shareable links.
- [ ] Updates whenever the operator saves a new matchday.

## Open Questions
- Requires the `elitesim-data` repo to be public (confirm the Stage 3 public/private decision).
- Same app or a separate lightweight read-only view? (Same app, a public route, is simplest.)
- How fresh does it need to be given the API vs. raw-CDN caching tradeoff?
