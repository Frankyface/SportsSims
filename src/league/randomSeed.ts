/**
 * A fresh random season seed. This is a UI action (uses Date/Math.random), NOT
 * part of the deterministic sim — a created league stores this seed, so its
 * season still re-simulates identically everywhere from the seed alone.
 */
export function randomSeed(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}
