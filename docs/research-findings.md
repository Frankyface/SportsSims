# Research Findings — EliteSimSPN feasibility (evidence base)

_From a 5-topic verification pass run 2026-07-07 before scaffolding. Verdict: **GO (with caveats).** This doc is the "why" behind the decisions in `CLAUDE.md` / `master_plan.md`. Read the relevant section before building that part._

---

## 0. Overall verdict

The v1 architecture — free static React app on GitHub Pages, deterministic seeded sim, Canvas render, **in-browser WebCodecs MP4 export**, league state as JSON committed via the GitHub API — is **feasible and genuinely free, no server for v1.** It's "with caveats" only because the two lovable parts (in-browser export, eventual auto-post) break if you take the naive path, and Rung-4 automation needs a GitHub Actions layer designed-for now.

**Prototype this FIRST (highest de-risk):** the vertical slice `seed → simulateMatch() → frame-stepped Canvas render → WebCodecs MP4 download`, then manually upload one clip to a real Reel to confirm Meta accepts the file. This proves the three highest-uncertainty bets at once (determinism, WebCodecs-on-Pages, exact-fps capture). Everything else is well-trodden.

---

## 1. Video export — `feasible-with-caveats`

**Do NOT trust `MediaRecorder` to emit MP4.** Chromium defaults to WebM; Safari only emits MP4; MP4 output is platform-encoder-dependent and fails silently on some machines. A single hard-coded container breaks somewhere.

**PRIMARY pipeline — WebCodecs:** frame-step the deterministic sim (don't real-time record). For each of ~900 frames (30s×30fps): render Canvas → wrap in a `VideoFrame` with an explicit timestamp → `VideoEncoder.encode()` as H.264 (`avc1.42E01E` or the safe `avc1.4d0034`, 1080×1920, 30fps, ~8–12 Mbps). Encode audio as AAC-LC (`mp4a.40.2`, 48kHz). Feed both to **`mp4-muxer`** (Vanilagy) with `fastStart:'in-memory'` (moov atom at front — Instagram requires it). Gate on `('VideoEncoder' in window)` + `VideoEncoder.isConfigSupported()`. **No SharedArrayBuffer, no COOP/COEP needed** → GitHub Pages' inability to set headers never bites. ~10× faster than real-time, exact 30fps.

**FALLBACK — `ffmpeg.wasm` single-thread:** record `canvas.captureStream(30)` + mixed audio via MediaRecorder (branch on `isTypeSupported()`), then transcode WebM→MP4 (`-c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart`). Single-thread core (~31MB) needs no headers; multi-thread (~2× faster) needs cross-origin isolation via **`coi-serviceworker`** (put in `/public`, load first, one auto-reload) — only add if you want the speed.

**Instagram Reel spec (not a constraint for 30s):** MP4/H.264 + AAC, 9:16 (1080×1920), 23–60 fps, ≤25 Mbps VBR, moov-at-front, API file cap 300MB. **Avoid HEVC** (triggers IG upload errors). Keep key graphics in the central **safe band** — avoid top ~220px and bottom ~400–450px (IG UI covers them).

Sources: MDN [isTypeSupported](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static) · [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) · [devtails canvas→MP4](https://devtails.xyz/adam/how-to-save-html-canvas-to-mp4-using-web-codecs-api) · [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) · [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) · [Meta Reel specs](https://developers.facebook.com/docs/instagram-platform/content-publishing/) · [IG safe zones](https://kreatli.com/guides/instagram-reels-safe-zone).

---

## 2. Deterministic soccer sim — `feasible`

**Two layers, enforced:** (1) pure `simulateMatch(config) → MatchResult{score, events[]}` with one seeded PRNG as its ONLY entropy; (2) a dumb renderer that just plays back `events[]`. No shared mutable state; no DOM in the sim. This is what makes headless server re-render a drop-in later.

**PRNG:** `xmur3` (string→uint32 seed) → `mulberry32` (float in [0,1)). ~5 lines each, from [bryc/code](https://github.com/bryc/code/blob/master/jshash/PRNGs.md). Derive each match seed from stable IDs (`leagueId:season:round:matchId`) so the whole fixture list is reproducible from the league seed.

**Determinism trap (load-bearing):** transcendental math (`Math.exp/sin/log/pow`, `**`) is "implementation-approximated" in ECMAScript → diverges across engines → breaks client↔server replay. Use only `+ - * /`, comparisons, bit ops, `Math.imul`; square with `x*x`. So model goals as **Bernoulli-per-event draws**, never Poisson-via-`exp`.

**Model:** simulate discrete **possessions**. Each: pick attacker (attack-weighted + home tilt + momentum), decide nothing/shot/foul; a shot draws a chance-quality → xG in ~[0.02, 0.7]; goal = `rand() < xG`. The sequence of draws **is** the event timeline (free). Drive outcomes from **shots/xG, not possession** (possession barely correlates with winning; show it as a cosmetic stat only).

**Drama engine:** a `momentum` state (−1..+1) that rises with recent shots/goals and **rubber-bands toward the trailing team** (manufactures comebacks + realistic draw rates). **Upsets without rigging:** compress team ratings so variance matters; per-match hidden "form-of-the-day" multiplier from the seed; a rare high-xG "worldie" any team can hit. Never hand-pick a winner.

**Calibration anchors** (Monte-Carlo 10k matches to hit these): ~2.7–3.0 combined goals/game, ~13 shots/team, ~11–12% conversion, per-shot xG ~0.10–0.15. Use Dixon-Coles/Poisson only as the yardstick, never in the loop.

**Render:** **highlight-reel edit**, not linear playback — map 90 min → ~30s non-linearly: fast-forward dead time, dwell 2–3s on goals, ~1s on big chances/cards. Abstract pitch = one ball token + team-colored discs (not 22 physics agents — illegible + a determinism hazard). Store `simVersion` on every saved match; freeze shipped versions. Cosmetic randomness (crowd, particles) uses a **separate** `renderSeed`.

Data model (TypeScript sketch): `TeamRating{attack,defense,finishing,discipline}` (multipliers ~0.8–1.25) · `MatchEvent{minute,type,team,xg,onTarget,scoreAfter,momentumAfter,shotXY,...}` · `MatchResult{config,score,events[],stats,renderSeed}`.

Sources: [bryc PRNGs](https://github.com/bryc/code/blob/master/jshash/PRNGs.md) · [MDN Math.exp](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/exp) · [xG](https://en.wikipedia.org/wiki/Expected_goals) · [Opta goal/shot data](https://theanalyst.com/articles/numbers-behind-premier-league-goal-explosion) · [possession vs winning](https://www.sofascore.com/news/understanding-the-effect-of-possession-pass-success-percentage-and-shots-on-target-in-football-matches).

---

## 3. Repo persistence — `feasible-with-caveats`

**Write:** `PUT /repos/{owner}/{repo}/contents/{path}` with `message`, `content` (whole file, Base64), and the file's **current blob `sha`** (required on update, else 409). Each `PUT` returns the new `sha` — reuse it for the next write. Read canonical state via the **Contents API GET** (fresh), **not** `raw.githubusercontent.com` (cached ~5 min → shows stale data right after a write).

**Base64 gotcha:** `btoa(JSON.stringify(...))` throws on the first accented name/emoji. Encode UTF-8 first: `btoa(String.fromCharCode(...new TextEncoder().encode(json)))`; decode with `TextDecoder` + `atob`.

**Token:** fine-grained PAT, **Only select repositories → `elitesim-data`**, **Contents: Read and write** only. Auth header `Authorization: Bearer <token>`. 5,000 req/hr (way more than needed). Personal accounts can set **No expiration**. A client-stored token can't be truly secret — so shrink blast radius (one throwaway data repo) rather than chase secrecy; worst case = revertible vandalism + 60-sec revoke/reissue.

**Pattern:** localStorage write-through cache + repo as source of truth. On load: paint from cache, then GET authoritative + `sha`, reconcile. On sim: mutate in memory → write-through to localStorage immediately → PUT to repo → store new `sha`. One PUT overwrites the whole file (no append) — always send full current JSON. Keep the file **< 1 MB** (Contents API base64 ceiling); **shard per season** as history grows. Raw `fetch` beats Octokit for v1 (single endpoint).

Sources: [Contents API](https://docs.github.com/en/rest/repos/contents) · [managing PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) · [MDN btoa](https://developer.mozilla.org/en-US/docs/Web/API/Window/btoa) · [raw CDN caching](https://github.com/orgs/community/discussions/46758).

---

## 4. Instagram auto-posting (Rung 3/4) — `feasible-with-caveats`

**Own-account posting skips App Review.** Meta: "If your app only serves your Instagram professional account… Standard Access is all your app needs." Stay in Development mode with yourself as a role-holder → no weeks-long review, no Business Verification. The newer **Instagram Login** path (`graph.instagram.com`, scope `instagram_business_content_publish`) needs **no Facebook Page** — just a **Professional** IG account.

**3-step Reel flow:** (1) `POST /<IG_ID>/media` with `media_type=REELS`, `video_url=<PUBLIC_MP4_URL>`, `caption` → returns a container id; (2) poll `GET /<CONTAINER_ID>?fields=status_code` until `FINISHED` (up to ~5 min); (3) `POST /<IG_ID>/media_publish`. Meta **fetches** the video from your URL — so the MP4 must sit at a public URL (use **GitHub Pages**, which serves `video/mp4` with range support; `raw.githubusercontent.com` is unreliable for this). Rate limit ~50–100/day (a non-issue).

**Token time-bomb:** long-lived IG tokens last **60 days**, die permanently if not refreshed. Need a **monthly cron refresh** workflow that writes the new token back to a repo Secret (requires a separate PAT with **Secrets: write** — the default `GITHUB_TOKEN` can't) + failure alerting.

**Spine = GitHub Actions:** free/unlimited on **public** repos, `ubuntu-latest` ships ffmpeg, `npx playwright install --with-deps chromium` gives headless Chromium. The deterministic sim re-renders from just the seed. **Publishing must be server-side** (secrets in Actions) — the browser app never holds an IG token. v1 target = **scheduled auto-post with a human-approval gate** (Actions Environment required reviewer, or a preview-Issue/PR-merge trigger a non-coder taps from a phone); Rung 4 removes the gate.

Sources: [Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/) · [Platform overview / Standard Access](https://developers.facebook.com/docs/instagram-platform/overview/) · [refresh_access_token](https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/) · [Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage).

---

## 5. Fandom mechanics — `feasible` (build into the data model NOW)

Prioritized checklist distilled from Marble League/Marbula One, Horse Race Tests, Marbles on Stream:

**P0 — ship in Season 1 (cheap, high-leverage):**
1. **Persistent named roster with color-coded identity** — fixed name, one dominant color, 2-tone kit, crest on the token; **same roster across seasons**. Color is the only identity a silent 30s clip conveys. Store with **immutable team IDs** (never renumber).
2. **Two-tier identity: named teams + named players** — twice the storylines (Teams' champ + individual champ). (Data model keeps `playerIdx` even while v1 UI is team-level.)
3. **Season-long standings as the core product**, not the clip — every video is "Matchday N," serialized with compounding stakes.
4. **Deterministic but upset-capable sim** — favorites lean, frequent upsets, surface pre-match form/odds so a guess feels skillful.
5. **Broadcast-package overlay** (scoreboard bug, lower-thirds, tale-of-the-tape, result end-card, wordmark) — **load-bearing, not polish**; it's the differentiator and substitutes for the commentator a faceless account can't record.
6. **Fixed posting ritual** (same time/days) — builds habit + concentrates early engagement (IG algorithm reward).
7. **Prediction hook + winner cliffhanger** every post ("Who wins? Comment before the whistle") — comments are IG's strongest ranking signal.

**P1 (seasons 1–3):** personality/rivalry metadata per competitor · auto-generated storyline/"commentary" caption beats from events · underdog/streak tracker (Horse Race Tests' "cyan never wins" was the biggest hook) · public standings/records page · season climax + reset.

**P2 (scale):** cross-sport shared universe · audience "adopt-a-team" · recap/power-ranking posts · light "odds"/predictions leaderboard.

**Trademark caution:** "ESPN" is a *descriptor* for the aesthetic — use an **original wordmark**, invented teams, no real logos/clubs/player likenesses.

Sources: [Marbula One](https://jellesmarbleruns.fandom.com/wiki/Marbula_One) · [Marble League](https://marblemagic.com/what-is-the-marble-league) · [Horse Race Tests](https://knowyourmeme.com/memes/subcultures/horse-race-tests) · [ESPN aired marbles](https://www.cnn.com/2020/05/01/us/espn-ocho-spt-trnd) · [faceless IG tactics](https://fluxnote.io/guides/faceless-instagram-reels-content-strategy).

---

## Architecture bets locked NOW (so Rung 4 stays reachable)

1. Two-layer split (pure sim / dumb renderer), no DOM in the sim.
2. Determinism hygiene as a lint rule (no transcendental math / `Math.random` / `Date.now` / rAF in the sim).
3. `simVersion` on every saved match; sim versions are append-only/frozen.
4. Renderer = pure function of `(events, renderSeed, frameIndex)`, fixed timestep, headless "capture mode."
5. Output = Reel spec from day one (1080×1920, 30fps, H.264/AAC, faststart, safe band).
6. Repo-as-database in a **separate** `elitesim-data` repo.
7. All token/publish logic isolated in an Actions-only "publisher" module.
8. All assets same-origin (self-host fonts) so headless render matches + coi-serviceworker stays an option.
9. Fandom scaffolding (immutable IDs, teams+players, standings, streak tracker, overlay fields) baked into the data model now.
