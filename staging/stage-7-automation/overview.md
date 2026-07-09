# Stage 7 — Automation ladder

> **Status (2026-07-09): NOW THE ACTIVE STAGE.** The content engine is deep enough to feed auto-posting — Soccer and Golf each export a whole season's videos + posts in one click, and the deterministic sim makes headless server-side re-render possible. **First action = the human unblock: `help.md` #4–6** (convert @EliteSimSPN to Professional, create a Meta dev app in Development mode, add the GitHub secrets) — surface those to the operator BEFORE building the Actions workflow.

## Goal
Climb from "you tap post" (Rung 1) to the self-running newsroom (Rung 4): batch/queue polish → scheduled auto-posting with a one-tap human-approval gate → fully hands-off posting on the ESPN calendar.

## Why this stage exists
"Fully automated" is the user's north star. The v1 architecture was deliberately built to reach it (deterministic sim, data-driven output, Reel-spec from day one), so this stage is assembly, not redesign.

## Features
- `feature-automation-ladder.md` — GitHub Actions spine: headless re-render + Instagram Graph API posting, with an approval gate.
- `feature-token-refresh.md` — the monthly 60-day token auto-refresh + failure alerting.

## Definition of done
- **Rung 3:** a scheduled Action sims the next slate, re-renders videos headlessly, and posts via the official API after the user taps "approve" (from a phone).
- **Rung 4:** the same pipeline with the approval gate removed — hands-off, on schedule.
- Token auto-refreshes monthly; failures alert the user before posting can break.

## Blocked by
v1 shipped (Stages 1–4); `help.md` items 4–6 (IG Professional account, Meta app, secrets).

## Big caveats (see research §4)
Posting stays own-account-only (Standard Access, no App Review). The 60-day token refresh is load-bearing. Fully-unattended synthetic posting sits in a platform-policy grey zone — the approval gate is the safer default for account longevity.
