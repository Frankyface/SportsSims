# help.md — Your To-Do List (things only you can do)

These are the tasks Claude **cannot** do for you — creating accounts, tokens, and flipping settings on websites. Each item says what it is, why it's needed, a link, and which stage it unblocks. Work top-to-bottom; do the "Stage 1" ones soon, ignore the later ones until we get there.

Legend: `[ ]` = to do · `[x]` = done

---

## 🟢 Needed for Stage 1 (do these first)

### [ ] 1. Turn on GitHub Pages for the `SportsSims` repo
- **What:** Flip the switch that publishes the app to a free public web address.
- **Why:** It's where your app (and later your videos) live online.
- **How:** Go to <https://github.com/Frankyface/SportsSims/settings/pages> → under **"Build and deployment" → Source**, choose **"GitHub Actions"** → save. (Claude will add the workflow that does the actual publishing.)
- **Unblocks:** Stage 1 (getting the app live).

### [ ] 2. Create a second repo just for league data: `elitesim-data`
- **What:** A separate, empty GitHub repo that will hold your standings/results as a file.
- **Why:** Keeping data separate from the app code means the "save key" (next item) can only ever touch this one harmless file — not your app.
- **How:** Go to <https://github.com/new> → **Repository name:** `elitesim-data` → **Public** (simplest; the data is meant to be seen) → tick **"Add a README file"** → **Create repository**.
- **Unblocks:** Stage 3 (saving standings) — but make it now so it's ready.

### [ ] 3. Create a "save key" (fine-grained token) for the app
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

### [ ] 4. Convert @EliteSimSPN to a Professional account
- **What/Why:** The Instagram API can only post from Business/Creator accounts, and posting to *your own* account skips Meta's long review process.
- **How:** Instagram app → Settings → **Account type and tools** → **Switch to professional account** → pick Business or Creator.
- **Unblocks:** Stage 7 (auto-posting).

### [ ] 5. Create a Meta developer app (leave it in "Development" mode)
- **What/Why:** The credential that lets a scheduled job post your Reels. Kept in Development mode + your own account = **no App Review needed**.
- **How:** <https://developers.facebook.com> → My Apps → **Create App** → pick an Instagram use case → add the **"Instagram (Instagram Login)"** product → **do not submit for App Review**. Add yourself and @EliteSimSPN under **App Roles** as Admin/Developer/Tester. Then generate a **long-lived access token** and copy it + your Instagram user ID.
- **Unblocks:** Stage 7.

### [ ] 6. Add the automation secrets to GitHub
- **What/Why:** So the scheduled poster can log in without exposing anything publicly.
- **How:** In the `SportsSims` repo → Settings → **Secrets and variables → Actions** → add `IG_ACCESS_TOKEN`, `IG_USER_ID`, `IG_APP_SECRET`, plus a second fine-grained token with **"Secrets: write"** (so the monthly auto-refresh can update the IG token). Claude will tell you the exact values when we build Stage 7.
- **Unblocks:** Stage 7 (hands-off posting + the 60-day token auto-refresh).

---

## ✅ Done
- [x] Created the `SportsSims` GitHub repo.
- [x] Registered the **@EliteSimSPN** Instagram handle.
