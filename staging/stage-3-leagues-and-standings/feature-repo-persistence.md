# Feature — Repo persistence (GitHub Contents API + token wizard)

## What
Save and load league history as JSON in the separate `elitesim-data` repo via the GitHub Contents API, with a friendly in-app Settings "wizard" for pasting the fine-grained token, and a localStorage write-through cache.

## Why
Free, versioned, portable persistence with no server — the repo is the database. Separate repo keeps the token's blast radius to one revertible file and avoids rebuilding the site on every save.

## Acceptance criteria
- [ ] Settings screen: paste-token field (stored in localStorage, never committed/bundled), with a "test connection" that confirms read/write to `elitesim-data`.
- [ ] Load: hydrate UI from localStorage instantly, then `GET` the authoritative file + blob `sha`, reconcile.
- [ ] Save: mutate in memory → write-through to localStorage → `PUT` the whole file Base64-encoded (**via `TextEncoder`, not bare `btoa`**) with the current `sha` → store the returned new `sha`.
- [ ] Read canonical state via the Contents API (not `raw.githubusercontent.com`, which caches ~5 min).
- [ ] Handle 409 conflicts (re-GET `sha`, retry) and token errors with plain-English messages.
- [ ] History sharded per season to stay under the 1 MB Contents-API ceiling.

## Technical notes
See `docs/research-findings.md` §3 for the exact API, the `sha`-on-update rule, and the base64 UTF-8 gotcha. Raw `fetch` (no Octokit) for v1.

## Open Questions
- Public vs private `elitesim-data`? Public = free tokenless reads (good for the later public standings page) but exposes the JSON; private = hidden but reads also need the token. **Leaning public.**
- Single-writer assumption (one device at a time) OK, or do we need robust multi-device conflict handling? (Solo operator → single-writer is fine; keep the 409 retry as a safety net.)
- When exactly does the app auto-save vs. require a "Save" click? (Least-effort favors auto-save after each sim/edit.)
