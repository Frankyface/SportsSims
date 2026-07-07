# EliteSimSPN — Elite Simulated Sports Programming Network

A fictional sports network. It simulates persistent, invented sports leagues — **Soccer first**, then Rugby, Golf, and more — and turns each match into a short, broadcast-styled replay video for Instagram [**@EliteSimSPN**](https://instagram.com/EliteSimSPN).

Think **ESPN, except every team, game, and season is simulated** — with real standings, title races, relegation-style drama, and recurring teams you get attached to. That "root for your team across a whole season" hook is the same engine that made marble racing (*Marbula One*), Horse Race Tests, and square-race accounts blow up. Our edge: nobody else wraps it in a credible broadcast package.

## Status

✅ **V1 shipped** — Soccer end-to-end: an Elo/Glicko-2 deterministic sim → animated MP4 (with audio) → persistent league, standings & playoffs → one-click matchday content pack (a video per game + a standings post + captions). Current state & next steps live in [`handoff.md`](handoff.md); the full vision in [`docs/master_plan.md`](docs/master_plan.md).

## Tech at a glance

React + Vite + TypeScript · HTML5 Canvas · **WebCodecs** in-browser video export (real Instagram-ready MP4) · a **deterministic seeded simulation** · league data saved as JSON via the GitHub API · hosted **free on GitHub Pages**. No server needed for v1.

## How this project is run

Solo, **non-coder** project built with an AI assistant. The documentation *is* the product plan — start with [`CLAUDE.md`](CLAUDE.md) to understand how work sessions operate.
