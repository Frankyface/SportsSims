# SGA logo drop-in

Save the SGA crest here as **`sga.png`** (this exact path: `public/logos/sga.png`).

- A transparent-background PNG works best; a square-ish shield crest ~1024×1024 is ideal.
- The app loads it at runtime and shows it on the golf intro card and the rankings card.
- Until the file is present, a drawn shield crest is used as a fallback — nothing breaks.

Any file placed in `public/` is served at the site root (and copied into the build), so once
`public/logos/sga.png` exists it appears everywhere automatically — no code change needed.
