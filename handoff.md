# Handoff — ESSPN / Crown League

_Last updated: 2026-07-08 · **V1 shipped & LIVE**. Post-V1 in progress: the match engine was upgraded to **continuous play** (no more highlight-reel cuts — flowing passes, risks, interceptions, a clock that counts up 0'→90'); Rugby **identity layer built** ahead of the rugby sim. **Next: the rugby match engine** (which now inherits the continuous-play renderer)._

## 🎯 Goals
V1 is done and live. **ESSPN** (the network) broadcasts the **Crown League** (the 6-club Soccer competition) and produces post-ready videos + standings posts with the real club crests. Post-V1 has now begun: Rugby's **Bastion Championships** — its six clubs, real crests, and a club-book — exist as an identity layer ahead of the rugby match sim. Remaining work is all post-V1.

## 📍 Current State — LIVE at frankyface.github.io/SportsSims
- **Live on GitHub Pages** (Pages Source = "GitHub Actions"; deploys on every push).
- **Brand:** ESSPN network wordmark **E·SS·PN** "presents" its competitions — the **Crown League** (Soccer) and now the **Bastion Championships** (Rugby). Real club crests + competition logos live in `src/assets/logos/`.
- **Rating model (Elo/Glicko-2, `src/ratings/`):** starting ratings are a **random draw — NOT tied to a club's archetype**; every new league uses a **random seed**. Ratings **carry over season-to-season with a small offseason drift**; a **"big offseason" raises volatility**. No regression to the mean. See `offseasonAdjust` in `glicko2.ts` + `advanceSeason` in `league.ts`.
- **Match sim (`src/sim/`):** deterministic possession/xG/momentum, calibrated (~2.9 goals, ~26 shots, ~23% draws). Determinism hygiene enforced (no transcendental math / `Math.random` in the sim). **SIM_VERSION 3**: now records **possession spans** for the continuous-play renderer — the score-deciding RNG stream is **call-for-call identical to v2** (guarded by `scoreCompat.test.ts` golden snapshot, so saved league scores re-sim byte-identically). A **choreographer** (`src/sim/choreographer.ts`, own `':pbp'` PRNG stream + shared formation table `src/sim/formation.ts`) expands spans into unbroken touch chains: passes between player slots, carries, risky through-balls, interceptions, shots/saves/misses, restarts. **Soccer only — no rugby sim yet.**
- **Video (`src/render/`, `src/export/`):** **CONTINUOUS PLAY** (the old beat-based highlight reel is gone). The director (`director.ts`) lays the touch chains on the render clock — the scorebug **clock counts up 0'→90'** in its own chip (fast through quiet spells, near real-time in big moments), the **score steps live on goals**, and `moments` drive lower-thirds (goals, big chances, saves, misses, cards incl. card chip, half-time) + audio cues. The scene (`renderScene.ts`) moves players every frame: formation base + possession push/compress + **runs to meet passes** + keeper ball-tracking + goal-celebration swarms; the ball travels every segment with arc/streak/interception-ping visuals — **no teleports** (distance-proportional pacing, machine-checked <160px/frame @30fps). Pitch sits below the scorebug so top-net goals stay visible. `drawFrame` stays a pure fn of `(model, t)` → preview & WebCodecs MP4 (1080×1920 H.264/AAC) stay identical; typical clip ~29-41s. The **matchday intro card** frames the two clubs with the Crown League crest centred; clubs without a crest render a **colour-badge fallback** (`drawCrestChip`).
- **League (`src/league/`):** 6-team double round-robin (30 games, 10 matchdays), **top-4 playoffs**, champion, offseason rollover. Persists to localStorage + optional GitHub repo (Contents API, token in Settings).
- **Content (`src/content/`):** one-click **matchday content pack** + **Download Season Content** (zip, in posting order).
- **UI (`src/ui/`):** tabbed app — **League / Friendly / Rugby / Settings**.
- **🏉 Rugby (Bastion Championships) — identity layer only, NO sim yet:**
  - **6 hand-authored clubs** in `src/ratings/rugbyTeams.ts` (Thornbury "Bulls", Highmoor "Stags", Saltcombe "Mariners", Ravensworth "Colliers", Duncarrow "Highlanders", Wrenshire "Poachers"), reusing the football `ClubDef` shape. `generateRugbyLeague` mirrors the soccer league generator (random-draw ratings).
  - **Real crests + the Bastion logo**, downscaled to 512px in `src/assets/logos/`, loaded via an **isolated** `src/render/rugbyLogos.ts` — kept fully separate from the soccer `logos.ts` so the soccer render/export path never loads rugby assets (and vice-versa).
  - A read-only **Rugby club-book tab** (`src/ui/RugbyTab.tsx`): crest, name, nickname, city, style archetype, colours and bio per club.
- **Tests: 60 passing** (incl. golden score-compat, choreography continuity/risk-staging, monotonic-clock, anti-teleport & runtime-band suites). **Build clean (`npm run build`).**

## 📂 Files
`src/sim` · `src/ratings` (glicko2, teams, **rugbyTeams**, strength) · `src/render` (director, renderMatch, standingsCard, wordmark, logos, **rugbyLogos**) · `src/export` · `src/league` · `src/content` · `src/ui` (LeagueTab, FriendlyTab, **RugbyTab**, SettingsTab, …) · `src/App.tsx` · `src/assets/logos` (soccer crests + Crown League + **6 rugby crests + bastion**).

## ✅ Things I've Changed (newest first)
- **Continuous-play match engine** (replaces the highlight reel): sim v3 records possession spans (score stream frozen vs v2 — golden-guarded); new `choreographer.ts` + `formation.ts` stage passes/risky balls/interceptions/restarts as one unbroken chain; `director.ts` rewritten (counting clock, live score keyframes, moments); new `renderScene.ts` (moving players, keeper tracking, celebration swarms, ball arcs/streaks/pings); scorebug clock chip; pitch moved below the bug so top-net goals are visible; translucent lower-thirds; audio now cue-driven by moments. 25 new tests incl. anti-teleport gate + overlay-priority + fuzz-found regression seeds; verified in-browser (pixel checks + real 13MB MP4 export smoke).
- **Rugby identity layer:** 6 Bastion Championships clubs (`rugbyTeams.ts` + tests), their real crests + the Bastion logo (downscaled, wired via the isolated `rugbyLogos.ts`), and a read-only **Rugby club-book tab**. Renamed the competition to **Bastion Championships** to match the crest artwork.
- **Restyled the matchday intro card** — the two clubs now frame the card with the Crown League crest centred; added a colour-badge crest fallback for clubs without a logo.
- Club book now uses the real embedded crests + Crown League branding.
- Bigger field (~75%) + 8 players/side; scaled-up UI; **random seed per league**; corrected Meridian crest; logos downscaled.
- **Real club crests + Crown League logo** in videos/standings/club book; league renamed **Crown League**.
- **Decoupled ratings from archetype + offseason carry-over model**; swapped Blackwater Wanderers → **Meridian FC**.
- Rebrand to **ESSPN** + 6 characterful clubs; shrank league to 6 teams (top-4 playoffs).
- **Download Season Content** (zip). Stage 4 matchday pack. Stage 3 persistent league. Stage 2 audio. Stage 1 renderer + WebCodecs export. Elo/Glicko-2 model. Docs scaffold + research.

## ❌ Deferred / Open questions
- **Rugby match sim not built** — identity/crests/club-book only. **Union vs league** scoring + target score-ranges still to lock (crests use "RFC"/union naming, so union is the leaning).
- Cosmetic crest backgrounds: **Highmoor** ("Stags") crest has a grey *gradient* baked background → shows as a grey square on dark cards; best **regenerated on a transparent/dark background**. **Bastion** logo has a *flat white* background → can be cleanly knocked out to transparent (offered — not yet done).
- ffmpeg.wasm export fallback for non-WebCodecs browsers (operator uses Chrome — deferred).
- Audio is basic procedural synthesis — worth an ear-check.
- **Playoffs are top-4 of 6** — could trim to **top-2 → a one-match Grand Final** (user's call, still open).
- **Cobalt Bay logo is a horizontal wordmark** — circle-crop shows its centre; could be regenerated as a round crest.

## ➡️ Next Up (post-V1)
1. **Stage 5 core — the Rugby match engine:** first lock **union vs league** (scoring + score ranges), then a deterministic rugby sim (tries/conversions/penalties/cards → believable scores + event timeline) + a rugby broadcast overlay, reusing the league/persistence/content/calendar spine. The isolated rugby modules are the seam.
2. Optional crest polish: knock out the **Bastion** white background; regenerate **Highmoor** on a transparent bg.
3. **Golf** — heats of 4, majors, season rankings (individual sport).
4. **Stage 6** — star players & drama; public standings page. **Stage 7** — automation ladder.
- Human tasks: `help.md` #3 (save token) to turn on cloud save; #4–6 for eventual auto-posting.

## 🔗 Pointer
→ Current stage folder: `staging/stage-5-rugby-and-golf/`
→ Active feature file: `staging/stage-5-rugby-and-golf/feature-rugby.md` (rugby **identity layer done**; the **sim** is the open work)
