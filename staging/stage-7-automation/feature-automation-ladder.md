# Feature — Automation ladder (Actions spine + IG posting)

## What
A GitHub Actions pipeline that, on a schedule, re-renders the deterministic sim headlessly (Playwright + Chromium + ffmpeg), hosts the MP4 on GitHub Pages, and publishes it to @EliteSimSPN via the Instagram Content Publishing API — with a human-approval gate for Rung 3, removed for Rung 4.

## Why
The free, GitHub-native path to the self-running newsroom. Publishing must run server-side (secrets in Actions), never in the browser app.

## Acceptance criteria
- [ ] Actions workflow imports the SAME sim + renderer, frame-steps headlessly to PNGs → ffmpeg → Reel-spec MP4.
- [ ] MP4 committed to a public Pages path → public `video_url`.
- [ ] 3-step publish: create REELS container → poll `status_code` to `FINISHED` → `media_publish`.
- [ ] Approval gate (Rung 3): Actions Environment required reviewer, or a preview Issue/PR the user merges from a phone.
- [ ] Rung 4: gate removed; runs on the season calendar cadence.
- [ ] Own-account only (Standard Access — no App Review).

## Open Questions
- Confirm Meta's fetcher accepts the specific GitHub Pages MP4 URL (needs one live end-to-end test).
- Approval-gate UX a non-coder taps from a phone: Environment reviewer vs. Issue-merge vs. a simple dispatch?
- Headless render fidelity (fonts/GPU) vs. desktop — self-host fonts; consider a Node canvas if variance is an issue.
- Public vs private automation repo (public = free unlimited Actions minutes).
