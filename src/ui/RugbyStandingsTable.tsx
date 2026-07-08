import { computeRugbyStandings, rugbyTeamById, type RugbyLeagueState } from '../league/rugbyLeague'
import { rugbyLogoUrl } from '../render/rugbyLogos'

/** Bastion Championships table — union columns: P W D L PD BP Pts. */
export function RugbyStandingsTable({ state }: { state: RugbyLeagueState }) {
  const rows = computeRugbyStandings(state)
  return (
    <table className="standings">
      <thead>
        <tr>
          <th>#</th>
          <th className="teamCol">Team</th>
          <th>P</th>
          <th>W</th>
          <th>D</th>
          <th>L</th>
          <th>PD</th>
          <th>BP</th>
          <th>Pts</th>
          <th className="formCol">Form</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const t = rugbyTeamById(state, r.teamId).identity
          const crest = rugbyLogoUrl(r.teamId)
          return (
            <tr key={r.teamId} className={i < 4 ? 'playoff' : ''}>
              <td>{i + 1}</td>
              <td className="teamCol">
                {crest ? (
                  <img className="crest-img" src={crest} alt="" style={{ background: t.color }} />
                ) : (
                  <span className="chip" style={{ background: t.color }} />
                )}
                {t.abbr}
              </td>
              <td>{r.played}</td>
              <td>{r.won}</td>
              <td>{r.drawn}</td>
              <td>{r.lost}</td>
              <td>
                {r.pd > 0 ? '+' : ''}
                {r.pd}
              </td>
              <td>{r.bonus}</td>
              <td className="pts">{r.points}</td>
              <td className="formCol">{r.form.join(' ')}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
