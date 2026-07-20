# help.md — Your To-Do List (things only you can do)

These are the tasks Claude **cannot** do for you — creating accounts, tokens, and flipping settings on websites. Each item says what it is, why it's needed, a link, and which stage it unblocks. Work top-to-bottom; do the "Stage 1" ones soon, ignore the later ones until we get there.

Legend: `[ ]` = to do · `[x]` = done

---

## 🟢 Needed for Stage 1 (do these first)

### [x] 1. Turn on GitHub Pages for the `SportsSims` repo
- **What:** Flip the switch that publishes the app to a free public web address.
- **Why:** It's where your app (and later your videos) live online.
- **How:** Go to <https://github.com/Frankyface/SportsSims/settings/pages> → under **"Build and deployment" → Source**, choose **"GitHub Actions"** → save. (Claude will add the workflow that does the actual publishing.)
- **Unblocks:** Stage 1 (getting the app live).

### [x] 2. Create a second repo just for league data: `elitesim-data`
- **What:** A separate, empty GitHub repo that will hold your standings/results as a file.
- **Why:** Keeping data separate from the app code means the "save key" (next item) can only ever touch this one harmless file — not your app.
- **How:** Go to <https://github.com/new> → **Repository name:** `elitesim-data` → **Public** (simplest; the data is meant to be seen) → tick **"Add a README file"** → **Create repository**.
- **Unblocks:** Stage 3 (saving standings) — but make it now so it's ready.

### [x] 3. Create a "save key" (fine-grained token) for the app
- **What:** A password-like key that lets the app save your league to the `elitesim-data` repo.
- **Why:** GitHub Pages apps can't save data on their own; this key is how the app writes your standings file. It's scoped so it can *only* edit that one data repo — nothing else.
- **How (click-by-click):**
  1. Go to <https://github.com/settings/personal-access-tokens/new> (confirm your password if asked).
  2. **Token name:** `EliteSim league writer`.
  3. **Expiration:** choose **"No expiration"** (least maintenance) — or 1 year + set yourself a reminder.
  4. **Resource owner:** your account (the one that owns `elitesim-data`).
  5. **Repository access:** select **"Only select repositories"** → pick **`elitesim-data`** only.
  6. **Permissions → Repository permissions →** find **"Contents"** → set to **"Read and write"**. (Leave everything else "No access"; "Metadata: Read-only" turns on by itself — that's fine.)
  7. Click **Generate token**, then **copy** it (it starts with `github_pat_…`). GitHub shows it **once**.
  8. Later, in the EliteSimSPN app's **Settings** screen, paste it and click Save. (If it ever leaks: come back here, Revoke it, and make a new one — a leak can only mess up one revertible data file.)
- **Unblocks:** Stage 3 (saving standings).

---

## 🟡 Needed later — Instagram auto-posting (Stage 7 only; ignore for now)

You do **not** need any of this for v1. In v1 you'll just download each finished video and post it to Instagram yourself. These are for when we automate posting.

> 📱 **Doing this on your phone?** Follow **[help-instagram-phone-setup.md](help-instagram-phone-setup.md)** — it turns items 4–6 below into click-by-click phone steps and tells you exactly what to screenshot/send if a screen looks different.

### [x] 4. Convert @EliteSimSPN to a Professional account
- **What/Why:** The Instagram API can only post from Business/Creator accounts, and posting to *your own* account skips Meta's long review process.
- **How:** Instagram app → Settings → **Account type and tools** → **Switch to professional account** → pick Business or Creator.
- **Unblocks:** Stage 7 (auto-posting).

### [x] 5. Create ONE Meta developer app (leave it in "Development" mode) — serves BOTH accounts ✅ DONE
- **What/Why:** The credential that lets a scheduled job post your Reels. Kept in Development mode + your own accounts = **no App Review needed**. You post golf + soccer on **two** Instagram accounts, but you only make **one** app — each account signs in and gets its own token.
- **Done:** One Meta app created (Development mode, Instagram Login product); each account connected and issued its own long-lived token + account ID. (Full phone steps kept in **[help-instagram-phone-setup.md](help-instagram-phone-setup.md)** for re-issuing a token later.)

### [x] 6. Add the automation secrets to GitHub ✅ DONE
- **What/Why:** So the scheduled poster can log in to each account without exposing anything publicly.
- **Done:** All 5 secrets are in the `SportsSims` repo and **verified working** (an Actions check confirmed both accounts authenticate): `IG_APP_SECRET`, `IG_USER_ID_GOLF` / `IG_ACCESS_TOKEN_GOLF`, `IG_USER_ID_SOCCER` / `IG_ACCESS_TOKEN_SOCCER`.
---

### [x] 7. Add a "token refresher" secret so the IG tokens never expire ⏳ DO THIS ONCE

- **What/Why:** Instagram tokens die after **60 days**. A weekly job now refreshes both tokens automatically — but to save the new token back into the repo it needs a GitHub token that's allowed to **write secrets** (the built-in one isn't). Add it once and you never touch tokens again.
- **Steps (≈3 min, on a computer or phone browser):**
  1. Go to <https://github.com/settings/personal-access-tokens/new> (fine-grained token; confirm password if asked).
  2. **Token name:** `EliteSim token refresher`. **Expiration:** pick the longest allowed (e.g. 1 year — set a reminder to redo it then).
  3. **Resource owner:** your account. **Repository access:** *Only select repositories* → choose **`Frankyface/SportsSims`**.
  4. **Permissions → Repository permissions → Secrets:** set to **Read and write**. (Leave everything else "No access".)
  5. **Generate token**, then **copy** it (starts with `github_pat_…` — shown once).
  6. Add it as a repo secret: **SportsSims → Settings → Secrets and variables → Actions → New repository secret.** **Name:** `GH_SECRETS_PAT` (exactly). **Value:** paste the token. **Add secret.**
  7. Tell me "refresher secret added" and I'll fire the refresh job once to confirm it works.
- **Until you do this:** the weekly refresh job just skips (no error), and the current tokens still work — but they expire ~60 days after they were issued, so do this within a few weeks.

---

## 🟠 Two one-click merges — do these to update the LIVE app (Stage 7)

> These are GitHub **Pull Requests** Claude prepared. Merging = one green button on github.com. Until you merge them, the automation content is correct but the *live web app* (frankyface.github.io/SportsSims) still has the old behaviour.

### [ ] 7. Merge the **golf audio** update (drops the golf-cart sound + cheers)
- **What/Why:** You flagged the awful golf-cart noise and the cheering on golf videos. That fix lives on the `feature/golf-audio` branch — golf now uses quiet rotating ambient beds, no cheers. It's not on the live app until you merge it.
- **How:** Go to <https://github.com/Frankyface/SportsSims/branches> → find **`feature/golf-audio`** → **"New pull request"** (base `main`) → **Create** → **Merge pull request** → **Confirm**. (Or tell Claude "merge golf-audio" and Claude will walk you through the exact button.)
- **Unblocks:** the LIVE golf videos losing the cart sound + cheers.

### [ ] 8. Merge the **season seed control** tool
- **What/Why:** The in-app tool to see/copy/roll/load a season's seed (so you can hunt good seeds for Season 2) lives on `feature/seed-control`. Same one-button merge.
- **How:** Same as #7 but for the **`feature/seed-control`** branch.
- **Unblocks:** the seed picker showing up in the live app.

---

## 🎨 Optional (cosmetic, any time)

### [x] Drop in crowd + music sounds for the match videos ✅ DONE
- **Done:** Your crowd recordings are wired in and live — 2 cheers (`cheer-1/2`), 3 boos (`boo-1/2/3`), and an ambient bed (`music-1`), trimmed to 5-7s and converted to deterministic 48kHz mono WAV. Cheers play on goals/big saves, boos on cards + away goals, the bed loops quietly under everything (all side-aware: louder for the home crowd).
- **To add or swap sounds later:** get royalty-free files (WAV preferred; MP3/OGG fine), name them by role — `music-*` (loopable bed), `cheer-*` (crowd roars), `boo-*` (jeers) — drop them in `src/assets/audio/` and tell Claude. The exporter finds them by name automatically.

### [x] Add the SGA (golf) logo
- **What:** Save the SGA crest you made as **`public/logos/sga.png`** in the `SportsSims` repo.
- **Why:** It shows on the golf rankings card and stands in on any event that doesn't yet have its own crest. Until it's there, the app draws a stand-in shield crest — nothing breaks, it just isn't your artwork.
- **How:** Put the PNG (transparent background, roughly square, ~1024px is ideal) at `public/logos/sga.png` and tell Claude (or commit it). Anything in `public/` is published automatically — no code change needed.
- **Unblocks:** nothing — pure branding polish.

### [x] Add the four Major logos (you already made these)
- **What:** Save the 4 major crests you generated, one PNG each, with these exact names:
  - `public/logos/evergreen-invitational.png` (The Evergreen Invitational)
  - `public/logos/saltmarsh-open.png` (The Saltmarsh Open)
  - `public/logos/redrock-classic.png` (The Redrock Classic)
  - `public/logos/pinnacle-championship.png` (The Pinnacle Championship)
- **Why:** Each shows on that major's **course-preview title card** and **round intro** automatically. Until the file is there, the drawn SGA crest stands in — nothing breaks.
- **How:** Drop the PNGs (transparent background ideal) at those paths and tell Claude (or commit them). The filename must match the event id exactly. Other tournaments can get crests the same way later — the id list is in `src/ratings/golfCourses.ts`.
- **Unblocks:** nothing — pure branding polish (but these four are worth it, they're the marquee events).

### [x] Regenerate the Highmoor "Stags" rugby crest on a transparent background
- **What:** Re-export the Highmoor RFC crest with a transparent (or dark) background instead of the grey one.
- **Why:** Its grey background shows as a grey square on the app's dark club cards. (The other five rugby crests blend fine; the Bastion league logo's *flat-white* background Claude can knock out automatically.)
- **How:** In your image tool, make the background transparent, save as PNG, drop it in a folder and tell Claude — Claude downscales + wires it in.
- **Unblocks:** nothing — pure polish. Do it whenever, or never.

---

## ✅ Done
- [x] Created the `SportsSims` GitHub repo.
- [x] Registered the **@EliteSimSPN** Instagram handle.
- [x] Supplied the 6 rugby club crests + the Bastion Championships logo.
