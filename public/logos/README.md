# Golf logo drop-ins

Any file placed in `public/` is served at the site root (and copied into the build), so once a
logo file exists it appears everywhere automatically — no code change needed. Transparent-background
PNGs work best; ~1024px is ideal. Until a file is present a drawn fallback crest is used — nothing breaks.

## SGA tour mark

Save the SGA crest as **`sga.png`** (`public/logos/sga.png`). Shows on the rankings card and as the
fallback crest for any event without its own logo.

## Per-event crests (keyed by event id)

Each SGA event can ship its own logo at **`public/logos/<event-id>.png`**. It's shown on that event's
course-preview title card and round-intro card (falling back to the SGA mark if absent). The four
majors' filenames:

| Event | File |
|---|---|
| The Evergreen Invitational | `public/logos/evergreen-invitational.png` |
| The Saltmarsh Open | `public/logos/saltmarsh-open.png` |
| The Redrock Classic | `public/logos/redrock-classic.png` |
| The Pinnacle Championship | `public/logos/pinnacle-championship.png` |

(The full id list lives in `GOLF_EVENTS` in `src/ratings/golfCourses.ts` — the `id` field of each event
is its filename. Tournaments can get crests too, same pattern.)
