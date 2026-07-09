# Feature — Automation ladder (Actions spine + IG posting)

## What
A GitHub Actions pipeline that, on a schedule, re-renders the deterministic sim headlessly (Playwright + Chromium running the app's **own** WebCodecs export — no PNG→ffmpeg re-render), hosts the MP4 on GitHub Pages, and publishes it to @EliteSimSPN via the Instagram Content Publishing API — hands-off (Rung 4), own-account only, with a one-switch pause.

## Spike result — 2026-07-09 (VERIFIED)
Headless render is **proven**. A Playwright runner drives `/headless.html` (which sims one match via the exact FriendlyTab recipe and calls `exportMatchMp4`) in **vanilla Chromium — the GitHub Actions engine** — with no GPU and no special flags:
- `VideoEncoder` (WebCodecs H.264) is available and works headlessly.
- Output: valid **1080×1920 H.264 + 48 kHz AAC** MP4, **54.7 s**, ~32.8 MB, encoded in **~22 s**.
- Approach beats the original plan: it captures the app's own export Blob, so the video is pixel-identical to the app (no re-render fidelity risk).
- Files: `headless.html`, `src/headless/exportOne.ts`, `scripts/headless-export.mjs` (spike/dev-only, isolated from the app UI).

## Why
The free, GitHub-native path to the self-running newsroom. Publishing must run server-side (secrets in Actions), never in the browser app.

## Acceptance criteria
- [x] ~~frame-step to PNGs → ffmpeg~~ → **superseded:** headless browser runs the app's own WebCodecs export and captures the MP4 Blob. VERIFIED locally in vanilla Chromium (see Spike result).
- [ ] Run that same runner inside an actual GitHub Actions **ubuntu** runner (confirm parity; check fonts render — self-host if needed).
- [ ] MP4 committed to a public Pages path → public `video_url`.
- [ ] 3-step publish: create REELS container → poll `status_code` to `FINISHED` → `media_publish`.
- [ ] Approval gate (Rung 3): Actions Environment required reviewer, or a preview Issue/PR the user merges from a phone.
- [ ] Rung 4: gate removed; runs on the season calendar cadence.
- [ ] Own-account only (Standard Access — no App Review).

## Open Questions
- Confirm Meta's fetcher accepts the specific GitHub Pages MP4 URL (needs one live end-to-end test).
- Approval-gate UX a non-coder taps from a phone: Environment reviewer vs. Issue-merge vs. a simple dispatch?
- ~~Headless render fidelity (fonts/GPU) vs. desktop~~ — RESOLVED: WebCodecs H.264 runs headlessly in vanilla Chromium with no GPU; the app's own export path runs unchanged so output can't diverge from the app. Still verify fonts in the ubuntu runner (self-host if any glyph falls back).
- Public vs private automation repo (public = free unlimited Actions minutes).
