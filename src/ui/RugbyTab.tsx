import { RUGBY_CLUBS, RUGBY_LEAGUE } from '../ratings/rugbyTeams'
import { rugbyLogoUrl, bastionLogoUrl } from '../render/rugbyLogos'

/**
 * Read-only rugby club book: the Bastion Championships lineup — crest, name,
 * nickname, city, style and personality for each club. No sim yet; this is the
 * identity layer so the clubs exist (and can build fandom) ahead of the engine.
 */
export function RugbyTab() {
  return (
    <div>
      <div className="leagueHead">
        <img className="league-logo" src={bastionLogoUrl} alt={RUGBY_LEAGUE.name} />
        <div>
          <h2>{RUGBY_LEAGUE.name}</h2>
          <span className="sub">{RUGBY_CLUBS.length} clubs · the ESSPN rugby competition</span>
        </div>
      </div>

      <p className="hint">
        Meet the clubs. The rugby match engine isn’t live yet — this is the lineup that’ll contest the {RUGBY_LEAGUE.short}.
      </p>

      <div className="clubGrid">
        {RUGBY_CLUBS.map((c) => {
          const crest = rugbyLogoUrl(c.id)
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
