# Handoff — ESSPN / Crown League
_Last updated: 2026-07-08 · **V1 shipped & LIVE**, plus branding / real-crest / offseason polish. Next: post-V1 (Rugby/Golf, star players, automation)._

## 🎯 Goals
V1 is done and live. **ESSPN** (the network) broadcasts the **Crown League** (the 6-club competition). The app sims a season and produces post-ready videos + standings posts with the real club crests. Remaining work is all post-V1.

## 📍 Current State — LIVE at frankyface.github.io/SportsSims
- **Live on GitHub Pages** (Pages Source = "GitHub Actions"; deploys on every push).
- **Brand:** ESSPN network wordmark **E·SS·PN** "presents" the **Crown League**. Real club crests + the Crown League logo live in `src/assets/logos/` (downscaled to ~512px; loaded via `src/render/logos.ts`).
- **Rating model (Elo/Glicko-2, `src/ratings/`):** starting ratings are a **random draw — NOT tied to a club's archetype**; every new league uses a **random seed** (different pecking order each reset). Ratings **carry over season-to-season with a small offseason drift** (a nudge from the season + transfer-window noise); a **"big offseason" raises a club's volatility**. No regression to the mean. See `offseasonAdjust` in `glicko2.ts` + `advanceSeason` in `league.ts`.
- **Match sim (`src/sim/`):** deterministic possession/xG/momentum, calibrated (~2.9 goals, ~26 shots, ~23% draws). Determinism hygiene enforced (no transcendental math / `Math.random` in the sim).
- **Video (`src/render/`, `src/export/`):** big pitch (~75% of the frame), **8 players/side**, broadcast overlay (scorebug / lower-thirds / intro / result) carrying the **real crests + Crown League logo**, procedural audio → WebCodecs MP4 (1080×1920 H.264/AAC).
- **League (`src/league/`):** 6-team double round-robin (30 games, 10 matchdays), **top-4 playoffs**, champion, offseason rollover. Persists to localStorage + optional GitHub repo (Contents API, token in Settings).
- **Content (`src/content/`):** one-click **matchday content pack** + **Download Season Content** (every game + an as-of standings post, in posting order, one `.zip` + `POSTING_ORDER.txt`).
- **UI (`src/ui/`):** scaled-up tabbed app (League / Friendly / Settings), Crown League logo header, crest per standings row.
- **Tests: 24 passing. Build clean (`npm run build`).**

## 📂 Files
`src/sim` · `src/ratings` (glicko2, teams, strength) · `src/render` (director, renderMatch, standingsCard, wordmark, logos) · `src/export` (webcodecs video + audio) · `src/league` (engine + persistence) · `src/content` (captions, matchdayPack, seasonContent) · `src/ui` · `src/App.tsx` · `src/assets/logos`.

## ✅ Things I've Changed (newest first)
- Club book now uses the real embedded crests + Crown League branding.
- Bigger field (~75%) + 8 players/side; scaled-up UI; **random seed per league** (fixes same-winner-on-reset); corrected Meridian crest; logos downscaled (11 MB → 1.4 MB).
- **Real club crests + Crown League logo** in videos, standings, and the club book; league renamed **Crown League**.
- **Decoupled ratings from archetype + offseason carry-over model** (replaced decay-to-mean); swapped Blackwater Wanderers → **Meridian FC**.
- Rebrand to **ESSPN** + 6 characterful clubs; shrank league to 6 teams (top-4 playoffs).
- **Download Season Content** (zip). Stage 4 matchday pack. Stage 3 persistent league. Stage 2 audio. Stage 1 renderer + WebCodecs export. Elo/Glicko-2 model. Docs scaffold + research.

## ❌ Deferred / Open questions
- ffmpeg.wasm export fallback for non-WebCodecs browsers (operator uses Chrome — deferred).
- Audio is basic procedural synthesis — valid track, worth an ear-check.
- **Playoffs are top-4 of 6** — could trim to **top-2 → a one-match Grand Final** (user's call, still open).
- **Cobalt Bay logo is a horizontal wordmark** (others are crests) — the circle-crop shows its centre; fine, but could be regenerated as a round crest.

## ➡️ Next Up (post-V1)
1. Optional polish the user floated: top-2 Grand Final, field to a full 80%+, richer player movement.
2. **Stage 5** — Rugby & Golf (reuse the engine).
3. **Stage 6** — star players & richer drama; public standings page.
4. **Stage 7** — automation ladder (GitHub Actions + Instagram API).
- Human tasks: `help.md` #3 (save token) to turn on cloud save; #4–6 for eventual auto-posting.

## 🔗 Pointer
→ Next stage folder: `staging/stage-5-rugby-and-golf/`
→ Active feature file: `staging/stage-5-rugby-and-golf/feature-rugby.md`
