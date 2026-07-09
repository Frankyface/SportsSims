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
- [x] Run that same runner inside an actual GitHub Actions **ubuntu** runner. **DONE + a wrinkle:** WebCodecs **H.264 works** in Actions Chromium, but its **AAC encoder does not** → videos render **video-only MP4 + a WAV sidecar** and `scripts/finalize-reels.mjs` ffmpeg-muxes AAC in CI. Fonts render fine.
- [x] MP4 hosted at a public URL → `video_url`. **DONE:** served from `raw.githubusercontent.com/<repo>/<sha>/content-out/…`; Instagram's fetcher accepts the `application/octet-stream` MP4s (proven — golf videos posted).
- [x] 3-step publish: create REELS container → poll `status_code` to `FINISHED` → `media_publish`. **DONE** (`scripts/ig-post.mjs`, per-account routing; carousels use `is_carousel_item` children → CAROUSEL). First live run published golf reels + the preview carousel.
- [x] **✅ FIXED** (commit `9e1143a`): the hosting **"Host assets" step** now force-pushes to a fresh orphan `content-host` branch (was failing as non-fast-forward rejection + "nothing to commit" exit 1 when committing onto the moving branch). Same fix on `ig-post-test.yml` (→ `ig-test-host`). Both live-post workflows also made `workflow_dispatch`-only. See handoff.md → 🤖 Auto-posting section.
- [ ] Approval gate (Rung 3): Actions Environment required reviewer, or a preview Issue/PR the user merges from a phone. _(Deferred until the manual seed drop lands.)_
- [x] **Rung 4 BUILT (paused)** (`caa3495`): `content-daily.yml` runs a daily cron that posts the NEXT day's content per account from the `automation-state` cursor, per the locked posting spec. Pure day→content map in `src/headless/dailyCalendar.ts` (13 unit tests). Scheduled runs post only when `state.json` `enabled=true` (one-switch pause); manual dispatch offers **dry-run** (generate + host, no post) for eyeballing. **To go live:** dry-run once, then flip `enabled`. Deferred within Rung 4: soccer **finals-preview** content piece + the **season-transition** re-roll (cursor holds at end-of-season).
- [x] Own-account only (Standard Access — no App Review). Two accounts (soccer + golf `simgatour`), one Meta app, per-account tokens — all 5 GitHub secrets in + verified.

## Live-run status — 2026-07-09
- **Pipeline built** on `automation/live-content`, then **merged to `main` via PR #4** (safe: tokens are in GitHub Secrets, not code; Pages serves only `dist/`). Files: `src/headless/contentSeed.ts`, `scripts/headless-content.mjs`, `scripts/finalize-reels.mjs`, `scripts/ig-post.mjs`, `.github/workflows/content-post.yml`.
- **Run 1** (pre-revision): golf round videos + preview carousel **posted successfully** to the golf account. Soccer step is where the operator saw the content and asked for the Reels/4:5 revision.
- **Revision applied + verified locally** (`content2/`): soccer + golf-round posts are Reels ending with the flashed scoreboard; golf preview is a 4:5 carousel; golf-cart bed deleted + cheers removed; real SGA crest; photos resized.
- **Run 2** (corrected, `29046645483`): Generate ✅, Finalize reels ✅, **Host assets ❌ (git push)**, Post skipped. → diagnosed (non-fast-forward + nothing-to-commit) and **fixed in `9e1143a`**.
- **Run 3 (`29051219139`): ✅ SUCCESS — full end-to-end.** Every step green: Generate ✅ → Finalize ✅ → **Host (orphan force-push) ✅** → **Post ✅**. `ig-post.mjs` exits non-zero on any failure, so the success exit = **all 12 items published** live (Soccer R1 → soccer account, Golf E1 → `simgatour`). The host-step fix is proven in CI. Seed drop DONE.
- **Cadence handover:** the `automation-state` cursor starts at soccer=3/golf=5 (exactly where the seed drop left off), enabled=false. Next: a `content-daily.yml` dry-run, then flip enabled.

## Open Questions
- Confirm Meta's fetcher accepts the specific GitHub Pages MP4 URL (needs one live end-to-end test).
- Approval-gate UX a non-coder taps from a phone: Environment reviewer vs. Issue-merge vs. a simple dispatch?
- ~~Headless render fidelity (fonts/GPU) vs. desktop~~ — RESOLVED: WebCodecs H.264 runs headlessly in vanilla Chromium with no GPU; the app's own export path runs unchanged so output can't diverge from the app. Still verify fonts in the ubuntu runner (self-host if any glyph falls back).
- Public vs private automation repo (public = free unlimited Actions minutes).
