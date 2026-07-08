# Match audio assets — drop your sounds here

Drop sound files in THIS folder and the exporter mixes them into every match
video automatically. No code changes needed — the engine discovers files by
name prefix at build time.

## Naming (prefix decides the role; add as many variants as you like)

| Prefix     | Role                                                | Examples                    |
|------------|-----------------------------------------------------|-----------------------------|
| `music-`   | Background bed, looped quietly under the whole clip | `music-1.mp3`, `music-2.wav`|
| `cheer-`   | Crowd cheer — plays on goals and big chances        | `cheer-1.wav`, `cheer-2.wav`|
| `boo-`     | Crowd boo — plays on cards                          | `boo-1.wav`                 |

- Formats: `.wav`, `.mp3`, or `.ogg`. **WAV is preferred** (mp3 decoders can
  differ very slightly between browsers; WAV decodes bit-identically).
- Multiple variants of the same prefix are fine — the engine picks one per
  moment deterministically (same match always sounds identical).
- Keep cheers ~1-4s, boos ~1-3s, music beds 20s+ (they loop).
- With no files present, the engine falls back to the built-in procedural
  crowd (murmur + whistles + roars), so this folder can stay empty.
