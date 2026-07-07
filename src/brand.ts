// Central brand identity. Change it here and it updates everywhere (wordmark,
// captions, filenames). The network's short brand is ESSPN.

export const BRAND = 'ESSPN'
export const HANDLE = '@ESSPN'
export const NETWORK_NAME = 'Elite Simulated Sports Programming Network'
export const HASHTAGS = '#ESSPN #SimSoccer'
export const FILE_PREFIX = 'esspn'

// Wordmark segments for canvas rendering: [text, isAccent].
// E-SS-PN → the "SS" (Simulated Sports) carries the accent colour.
export const WORDMARK: Array<[string, boolean]> = [
  ['E', false],
  ['SS', true],
  ['PN', false],
]
