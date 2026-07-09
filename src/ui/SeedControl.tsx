import { useState, type CSSProperties } from 'react'

const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  margin: '10px 0 14px',
  padding: '8px 10px',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.03)',
  fontSize: '0.9rem',
}
const valueStyle: CSSProperties = {
  fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
  padding: '2px 8px',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.08)',
  userSelect: 'all',
}
const inputStyle: CSSProperties = {
  flex: '1 1 140px',
  minWidth: 120,
  padding: '5px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(0,0,0,0.2)',
  color: 'inherit',
}

/**
 * Shows the current season's seed and lets you copy it, roll a fresh random
 * season, or load a specific seed — so good seasons can be found and named.
 *
 * Rolling/loading REPLACES the season on this device. Nothing is truly lost: a
 * seed reproduces its season exactly, so copy the seed before you reshuffle.
 */
export function SeedControl({
  seed,
  onLoad,
  onRandom,
}: {
  seed: string
  onLoad: (seed: string) => void
  onRandom: () => void
}) {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  async function copySeed(): Promise<void> {
    try {
      await navigator.clipboard.writeText(seed)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — the seed is still shown to copy by hand */
    }
  }

  const trimmed = input.trim()
  return (
    <div style={rowStyle}>
      <span style={{ opacity: 0.7, fontWeight: 600 }}>🌱 Season seed</span>
      <code style={valueStyle}>{seed}</code>
      <button className="btn ghost small" onClick={() => void copySeed()}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <button className="btn ghost small" title="Roll a fresh random season" onClick={onRandom}>
        🎲 New
      </button>
      <input
        style={inputStyle}
        placeholder="load a seed…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && trimmed) onLoad(trimmed)
        }}
      />
      <button className="btn small" disabled={!trimmed} onClick={() => onLoad(trimmed)}>
        Load
      </button>
    </div>
  )
}
