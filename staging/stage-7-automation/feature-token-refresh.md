# Feature — Instagram token auto-refresh

## What
A scheduled (monthly) GitHub Action that refreshes the long-lived Instagram access token before its 60-day expiry and writes the new token back into repo Secrets, with failure alerting.

## Why
Long-lived IG tokens die permanently if not refreshed within 60 days. Without this, hands-off posting silently stops two months in. It's load-bearing for any automation.

## Acceptance criteria
- [ ] Monthly cron workflow calls `GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token` and stores the new token.
- [ ] Writes the refreshed token back to the `IG_ACCESS_TOKEN` Secret (needs a separate PAT with **Secrets: write** — the default `GITHUB_TOKEN` can't).
- [ ] Failure alerting (workflow-failure notification / Issue / email) so the user knows before posting breaks.
- [ ] Runs well inside the token's refreshable window (>24h old, <60 days).

## Open Questions
- Alerting channel the user will actually see (email vs. GitHub notification vs. push)?
- Where to store the crown-jewel Secrets-write PAT, and its rotation policy?
- Belt-and-suspenders: also refresh opportunistically on each posting run, not only monthly?
