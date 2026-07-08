# Bundled display font — Barlow Semi Condensed

`BarlowSemiCondensed-{SemiBold,Bold,ExtraBold}.woff2` (weights 600 / 700 / 800,
**latin subset only**, ~23KB each) power the ESSPN graphics (league tables + team
cards). A tall condensed grotesque was chosen so 6–7 numeric columns + a 5-pill
form guide fit at 1080px wide without crushing, and long club names still read big.

- **Family:** Barlow Semi Condensed — designed by Jeremy Tribby.
- **Licence:** SIL Open Font License 1.1 (free to bundle & redistribute).
- **Source:** Google Fonts (`fonts.gstatic.com`), latin subset of v16.

Bundled same-origin (Vite hashes them to first-party URLs) so drawing text to a
canvas never taints it — the same guarantee the crest PNGs rely on for the
WebCodecs MP4 export. Loaded via the FontFace API in `src/render/fonts.ts`,
awaited inside `ensureLogosLoaded()` / `ensureRugbyLogosLoaded()` so no PNG ever
exports in the fallback face.
