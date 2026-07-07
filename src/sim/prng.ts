// Deterministic PRNG — the ONLY source of randomness allowed in the sim.
// xmur3 (string -> uint32 seed) feeds mulberry32 (uint32 -> float in [0,1)).
// Both use only integer/bitwise ops + Math.imul, so results are byte-identical
// across browsers and Node (required for later server-side re-render).
// Source: bryc/code jshash/PRNGs.md — see docs/research-findings.md §2.

export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Numeric uint32 seed derived from a stable string key. */
export function seedFromKey(seedKey: string): number {
  return xmur3(seedKey)()
}

/** A seeded [0,1) generator from a stable string key. */
export function makeRng(seedKey: string): () => number {
  return mulberry32(seedFromKey(seedKey))
}
