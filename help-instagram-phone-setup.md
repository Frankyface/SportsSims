# 📱 Instagram Auto-Posting Setup — Phone Walkthrough

This is the one-time setup that lets the robot post your sim videos to Instagram on its own. It's the only part I (Claude) can't do for you — creating accounts and flipping settings on websites.

**The deal:** *You* do the clicking on accounts/websites. *I* do 100% of the code, tokens, and wiring. **You never need to send me a password, a token, or a secret.**

**Golden rule:** the moment any screen doesn't match what's written here, **take a screenshot and send it to me.** Meta moves their buttons around constantly — I'll tell you exactly what to tap. Don't guess, don't push through.

You can stop after any Part and pick up later. Budget ~40 minutes total.

---

## 📣 You have TWO accounts — here's how that works

You post **golf on one account** and **soccer on another**. Good news: you still make **ONE app** (one "keychain"). Each account just signs in separately and gets its **own token** (its own key on that keychain).

So the only thing you do *twice* is **Part 3** (connect the account + copy its token) — once for golf, once for soccer. Everything else you do **once**.

Keep a note like this in your phone's Notes app as you go:

```
=== THE APP (shared by both) ===
App ID:      ____________________
App Secret:  ____________________   (password — keep private)

=== GOLF ACCOUNT ===
Account ID:  ____________________
Token:       ____________________   (password — keep private)

=== SOCCER ACCOUNT ===
Account ID:  ____________________
Token:       ____________________   (password — keep private)
```

---

## Before you start — quick check

- [ ] You can log into **both** Instagram accounts (golf + soccer).
- [ ] You have a **Facebook account** (any personal one — it's just the "key" to Meta's developer site; it is *not* shown on or linked to your Instagram feeds). No Facebook account? Make a free one at facebook.com first.
- [ ] ~40 minutes.

---

## Part 1 — Make BOTH accounts "Professional"
*(Easiest part. Do this in the Instagram app, for each account. ~3 min each.)*

The robot can only post to Professional (Business) accounts. Switching is free, reversible, and invisible to followers.

**Do this for the golf account, then repeat for the soccer account:**
1. Open the **Instagram app**, logged in as that account.
2. Tap your profile picture → the **☰ menu** (top-right) → **Settings and privacy**.
3. Find **Account type and tools** → tap **Switch to professional account**.
4. Choose **Business** (simplest for auto-posting).
5. Pick any category. You can skip the "connect a Facebook Page" prompt — **you don't need one.**

✅ **Done when:** both accounts show professional tools (e.g. an "Insights" option).
*(If one or both were already switched, just skip it — nothing to redo.)*

---

## Part 2 — Create ONE Meta developer "app"
*(The shared "keychain" the robot uses to log in and post. Kept in test mode = no approval process. Do this ONCE. ~10 min in your phone's browser.)*

1. In your phone browser, go to **developers.facebook.com**.
2. Log in with your **Facebook** account. First time? It'll ask you to **register as a developer** — say yes, agree, verify by phone/email if asked.
3. Menu → **My Apps** → **Create App**.
4. **App name:** anything (e.g. `EliteSim Poster`). It serves both feeds, so a neutral name is fine.
5. **Use case / what do you want to do:** pick the option that mentions **Instagram** / **"Instagram API"** (wording shifts; sometimes it's *"Other"* → app type *"Business"*).
   - 📸 **Not sure which to pick? Screenshot the list and send it — I'll point at the exact one.**
6. Finish. You land on the app **Dashboard**.
7. **Copy the App ID and App Secret** into your Notes (under "THE APP"). The Secret is usually under **App settings → Basic** (tap "Show"). These belong to the app, so they're the **same for both accounts.**

✅ **Done when:** your Notes has the shared **App ID + App Secret**, and you're on the app Dashboard.

---

## Part 3 — Connect an account + grab its token  ⟳ DO THIS TWICE
*(~8 min per account. Once signed in as GOLF, once as SOCCER. Go slow, screenshot if unsure.)*

1. On the app Dashboard, open **Instagram** (or "Add product" → **Instagram** → **Set up**) → the section **"API setup with Instagram login."**
2. Find the step to **add / connect an Instagram account**. Tap it — an Instagram login pops up. **Log in as the account you're doing right now (start with golf), and tap Allow.**
3. After it connects, find and copy into Notes (under that account's section):
   - 🔑 **Instagram account ID** (a long number)
   - 🔒 the **access token** — usually a **"Generate token" / "Generate access token"** button next to the connected account. Tap it, approve, copy the long token. *(Password — keep private.)*
4. **Now repeat steps 1–3 for the other account:** on the same page, connect/add the **soccer** account (it may ask you to switch/log in as soccer), generate **its** token, and save its ID + token under the soccer section.

📸 **The "Generate token" screen is the one most likely to look different — if you can't find it, or a login is blocked because the app is in test mode, screenshot the whole "API setup with Instagram login" section and send it.** (If it's a test-mode block, the fix is adding that account as a tester — I'll walk you through it.)

✅ **Done when:** your Notes has an **account ID + token for BOTH** golf and soccer. Then message me: **"Part 3 done — I've got both accounts' IDs and tokens."**

---

## Part 4 — Hand off to me (the safe part)
*(We finish together. ~5 min. Easier on a computer if you can, but your phone works.)*

Once you tell me Part 3 is done, I'll give you the exact **secret names** to paste into GitHub (repo → **Settings → Secrets and variables → Actions**). It'll be roughly:

```
IG_APP_SECRET          (the one shared secret)
IG_USER_ID_GOLF        IG_ACCESS_TOKEN_GOLF
IG_USER_ID_SOCCER      IG_ACCESS_TOKEN_SOCCER
```

*You* paste the values (so I never see your passwords); I just tell you which box each goes in. Then I handle everything technical: turning each token into the long-lasting 60-day kind, the **monthly auto-refresh** for both (so posting never silently dies), and the posting robot that sends golf→golf and soccer→soccer.

Nothing to prepare for Part 4 — just come back to me after Part 3.

---

## If you get stuck (you won't break anything)

- **Screenshot the screen and send it.** Always the right move — I can read Meta's screens and tell you the next tap.
- Nothing here can harm your accounts or cost money. The app stays in test mode; worst case we redo a step.
- Pause and resume anytime — the websites save your progress.

*I'll be working on the video-rendering half while you do this, so we're building both ends at once.*
