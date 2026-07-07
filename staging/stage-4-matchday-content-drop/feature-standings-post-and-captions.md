# Feature — Standings post & auto-captions

## What
After a matchday, generate (a) a standings-update visual (the "second post" the user wanted — an updated-table graphic, image or short video) and (b) an auto-written caption for each game video and the standings post, including a prediction hook / cliffhanger.

## Why
The updated-standings post is half the content plan. Captions with a prediction ask ("Who wins next? 👇") are the top comment-driver on IG (research §5) — comments are the strongest ranking signal.

## Acceptance criteria
- [ ] Standings-update asset generated from the same league JSON (table with movers, in brand style, IG-sized).
- [ ] Per-game caption template: matchup, result/story beat, prediction hook, hashtags — derived from the sim events.
- [ ] Standings-post caption: title race / relegation / streak callouts.
- [ ] Captions are copy-pasteable (or exported alongside each video).
- [ ] Original branding only (no real league/club/ESPN marks).

## Technical notes
Caption generation is template-driven from match/season data in v1 (an optional AI-API pass for extra flair is a later, opt-in add — keeps v1 free). The richer storyline/"commentary" engine is Stage 6.

## Open Questions
- Winner cliffhanger mechanic: withhold results to a follow-up, pinned comment, or end-on-photo-finish? Each has different workflow cost.
- How much hashtag/wording tuning belongs in-app vs. left to the user? (Provide good defaults, let them edit.)
- Standings post as static image or a short animated video (table sliding into place)? (Image is simpler; animation is more on-brand.)
