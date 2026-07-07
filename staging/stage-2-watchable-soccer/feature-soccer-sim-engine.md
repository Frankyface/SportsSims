# Feature — Soccer sim engine (calibrated)

## What
Flesh out `simulateMatch()` into a believable, dramatic soccer model: possession ticks, shots with xG-style conversion, fouls/cards, and a momentum/comeback mechanic — all still deterministic and pure.

## Why
This is the watchability engine. The scoreline must feel real, upsets must happen without feeling rigged, and there must be late drama — that's what makes a clip (and a season) worth following.

## Acceptance criteria
- [ ] Possession-tick model with attack-vs-defense-driven shot generation; possession shown as a cosmetic stat only.
- [ ] Chance-quality → xG mapping; goals via Bernoulli draw (`rand() < xG`).
- [ ] Momentum state (−1..+1) with a trailing-team rubber-band (manufactures comebacks/late equalizers).
- [ ] Per-match hidden "form-of-the-day" multiplier + rare "worldie" event for honest upsets.
- [ ] **Monte-Carlo calibration test** (10k matches) hits real anchors: ~2.7–3.0 goals/game, ~13 shots/team, ~11–12% conversion, realistic draw rate.
- [ ] Still fully deterministic (determinism test from Stage 1 still passes) with `simVersion` bumped.

## Technical notes
See `docs/research-findings.md` §2 for the model, calibration anchors, and the exact loop sketch. Keep Dixon-Coles/Poisson as the calibration yardstick only, never in the sim loop.

## Open Questions
- Brand "scoreline personality": grind-y 1–0s vs end-to-end 3–2 thrillers? (One tuning knob; a creative call — maybe lean slightly toward thrillers for IG.)
- Cards/injuries: how much do they affect play vs. just being flavor events? Keep light for v1.
- Do fouls/possession stats need to be realistic too, or just goals/shots/xG? (Cosmetic stats can be looser.)
