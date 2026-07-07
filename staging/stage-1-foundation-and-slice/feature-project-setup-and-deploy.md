# Feature — Project setup & auto-deploy to GitHub Pages

## What
Scaffold the React + Vite + TypeScript app and a GitHub Actions workflow that builds and publishes it to GitHub Pages automatically on every push to `main`.

## Why
Everything is verified on the live site, not just locally. A one-push-to-live pipeline means the non-coder user always has a working URL to look at, and it's the same public host that will later serve videos for auto-posting.

## Acceptance criteria
- [ ] `npm create vite@latest` (React + TS) scaffolded; `npm run dev` and `npm run build` both work.
- [ ] Vite `base` set correctly for a project Pages site (`/SportsSims/`) so assets load.
- [ ] `.github/workflows/deploy.yml` builds and deploys `dist/` to Pages via the official Pages Actions.
- [ ] A visible "hello EliteSimSPN" shell is live at the `*.github.io/SportsSims/` URL.
- [ ] A basic app shell with room for tabs (Sim a Match, League, Standings, Settings) — empty is fine.

## Technical notes
- Pages source = "GitHub Actions" (user sets this — `help.md` #1).
- Self-host any fonts from `/public` (no CDN hotlinks) — keeps headless render consistent later and preserves the option to add `coi-serviceworker`.
- Keep folder structure feature-oriented: `src/sim/`, `src/render/`, `src/export/`, `src/data/`, `src/ui/`.

## Open Questions
- Project Pages (`/SportsSims/` base path) vs a custom domain later? Start with the default `*.github.io/SportsSims/`.
- Do we want a component library (e.g. a lightweight one) or hand-rolled CSS? Lean hand-rolled/minimal for v1 to keep the bundle small.
- Testing setup: Vitest from day one? (Recommended, since the sim needs Monte-Carlo calibration tests.)
