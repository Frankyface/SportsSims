import { useEffect, useMemo, useState } from 'react'
import type { CardProgress, ClubCard } from '../content/clubCardsPack'
import { downloadBlob } from '../export/exportMp4'

/**
 * Produce + download the evergreen Instagram club-card set for a competition.
 * One button generates all six 1080x1350 cards; each is previewed with its
 * ready-to-paste caption and can be downloaded individually or all at once.
 */
export function ClubCardsPanel({ build }: { build: (onProgress?: CardProgress) => Promise<ClubCard[]> }) {
  const [cards, setCards] = useState<ClubCard[] | null>(null)
  const [prog, setProg] = useState<{ p: number; label: string } | null>(null)

  // Object URLs for the thumbnails; revoked whenever the card set changes.
  const previews = useMemo(() => (cards ? cards.map((c) => URL.createObjectURL(c.blob)) : []), [cards])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  async function produce() {
    setCards(null)
    setProg({ p: 0, label: 'starting' })
    try {
      const c = await build((p, label) => setProg({ p, label }))
      setCards(c)
    } catch (e) {
      window.alert('Club cards failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setProg(null)
    }
  }

  async function downloadAll() {
    if (!cards) return
    for (const c of cards) {
      downloadBlob(c.blob, c.file)
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  return (
    <div className="pack">
      <p className="hint">
        One Instagram identity card per club (1080×1350) — post them as a “meet the clubs” series.
      </p>
      <div className="controls">
        <button className="btn" onClick={produce} disabled={prog !== null}>
          {prog ? `Rendering… ${Math.round(prog.p * 100)}% · ${prog.label}` : '🖼️ Make club cards'}
        </button>
        {cards && (
          <button className="btn ghost" onClick={downloadAll}>
            ⬇ Download all ({cards.length})
          </button>
        )}
      </div>
      {cards && (
        <ul className="cardItems">
          {cards.map((c, i) => (
            <li key={c.abbr}>
              <img className="cardPreview" src={previews[i]} alt={`${c.name} card`} />
              <div className="cardMeta">
                <div className="packRow">
                  <span>🖼️ {c.file}</span>
                  <button className="btn ghost small2" onClick={() => downloadBlob(c.blob, c.file)}>
                    Download
                  </button>
                </div>
                <textarea readOnly value={c.caption} rows={5} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
