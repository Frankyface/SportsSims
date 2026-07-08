import type { ClubDef } from '../ratings/teams'
import type { CardProgress, ClubCard } from '../content/clubCardsPack'
import { ClubCardsPanel } from './ClubCardsPanel'

/**
 * Read-only club book for a competition: the download-all-cards panel plus the
 * on-screen roster of characterful clubs. Shared by the Soccer (Crown League) and
 * Rugby (Bastion Championships) tabs — only the data + crest resolver differ.
 */
export function ClubBook({
  title,
  subtitle,
  logoUrl,
  clubs,
  crestUrl,
  buildCards,
}: {
  title: string
  subtitle: string
  logoUrl: string
  clubs: ClubDef[]
  crestUrl: (id: string) => string | undefined
  buildCards: (onProgress?: CardProgress) => Promise<ClubCard[]>
}) {
  return (
    <div>
      <div className="leagueHead">
        <img className="league-logo" src={logoUrl} alt={title} />
        <div>
          <h2>{title}</h2>
          <span className="sub">{subtitle}</span>
        </div>
      </div>

      <h3 className="sectionH">🖼️ Instagram club cards</h3>
      <ClubCardsPanel build={buildCards} />

      <div className="clubGrid">
        {clubs.map((c) => {
          const crest = crestUrl(c.id)
          return (
            <article key={c.id} className="clubCard" style={{ borderTopColor: c.color }}>
              <div className="clubTop">
                {crest ? (
                  <img className="clubCrest" src={crest} alt={`${c.name} crest`} />
                ) : (
                  <span className="clubCrest fallback" style={{ background: c.color }}>
                    {c.abbr}
                  </span>
                )}
                <div className="clubMeta">
                  <h3>{c.name}</h3>
                  <span className="nick">“{c.nickname}”</span>
                  <span className="sub">
                    {c.city} · {c.archetype}
                  </span>
                  <span className="swatches" aria-hidden="true">
                    <span style={{ background: c.color }} />
                    <span style={{ background: c.colorAlt }} />
                  </span>
                </div>
              </div>
              <p className="clubDesc">{c.description}</p>
            </article>
          )
        })}
      </div>
    </div>
  )
}
