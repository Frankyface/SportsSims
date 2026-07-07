import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Guard: the sim modules must never use non-deterministic or implementation-
// approximated APIs, which would silently break replay identity across engines.
// (See CLAUDE.md -> Determinism hygiene.)
const simDir = dirname(fileURLToPath(import.meta.url))
const banned: RegExp[] = [
  /\bMath\.random\b/,
  /\bDate\.now\b/,
  /\bperformance\.now\b/,
  /\bMath\.(exp|log|pow|sin|cos|tan|atan|asin|acos)\b/,
  /\brequestAnimationFrame\b/,
]

/** Strip comments so a banned API merely *named* in a doc-comment isn't a false positive. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

describe('sim determinism hygiene', () => {
  const files = readdirSync(simDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  it('scans at least one sim source file', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const f of files) {
    it(`${f} uses no non-deterministic APIs`, () => {
      const src = stripComments(readFileSync(join(simDir, f), 'utf8'))
      for (const re of banned) {
        expect(re.test(src), `${f} must not use ${re}`).toBe(false)
      }
    })
  }
})
