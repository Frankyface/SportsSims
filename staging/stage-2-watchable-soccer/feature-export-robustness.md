# Feature — Export robustness (fallback & hardening)

## What
Make export reliable beyond the happy path: add the `ffmpeg.wasm` single-thread fallback for browsers/machines without WebCodecs H.264, harden format edge cases, and add a clear progress UI.

## Why
WebCodecs H.264 availability can depend on the platform's encoder. A fallback + good feature detection means "Export" never just fails silently — which matters a lot for a non-coder who can't debug.

## Acceptance criteria
- [ ] `VideoEncoder.isConfigSupported()` gate; on failure, fall back to MediaRecorder (`isTypeSupported()` branch) → `ffmpeg.wasm` single-thread transcode to MP4 (`-movflags +faststart`).
- [ ] `ffmpeg.wasm` core assets bundled **same-origin** in the repo (no CDN hotlink).
- [ ] Export shows a progress bar and a friendly error if something goes wrong.
- [ ] Verified: output MP4 uploads cleanly as an IG Reel from both paths.
- [ ] (Optional) `coi-serviceworker` added only if multi-thread ffmpeg speed is wanted later.

## Technical notes
See `docs/research-findings.md` §1. Single-thread ffmpeg needs no COOP/COEP headers — prefer it to avoid the service-worker reload. Never hard-code a MediaRecorder mimeType.

## Open Questions
- Which browser will the operator actually export in? If it's always Chrome/Edge, WebCodecs alone suffices and this fallback could be deferred (but it's cheap insurance).
- Is the ~31MB ffmpeg core acceptable to bundle, or lazy-load it only when the fallback triggers? (Lazy-load recommended.)
