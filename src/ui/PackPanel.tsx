import type { MatchdayPack } from '../content/matchdayPack'
import { downloadBlob } from '../export/exportMp4'

export function PackPanel({ pack }: { pack: MatchdayPack }) {
  async function downloadAll() {
    for (const it of pack.items) {
      downloadBlob(it.blob, it.name)
      await new Promise((r) => setTimeout(r, 400))
    }
  }
  const allCaptions = pack.items.map((it) => `### ${it.name}\n${it.caption}`).join('\n\n———\n\n')

  return (
    <div className="pack">
      <div className="controls">
        <button className="btn" onClick={downloadAll}>
          ⬇ Download all ({pack.items.length})
        </button>
        <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(allCaptions)}>
          Copy all captions
        </button>
      </div>
      <ul className="packItems">
        {pack.items.map((it) => (
          <li key={it.name}>
            <div className="packRow">
              <span>
                {it.kind === 'video' ? '🎬' : '📊'} {it.name}
              </span>
              <button className="btn ghost small2" onClick={() => downloadBlob(it.blob, it.name)}>
                Download
              </button>
            </div>
            <textarea readOnly value={it.caption} rows={4} />
          </li>
        ))}
      </ul>
    </div>
  )
}
