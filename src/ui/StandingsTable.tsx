import type { LeagueState } from '../league/types'
import { computeStandings, teamById } from '../league/league'

export function StandingsTable({ state }: { state: LeagueState }) {
  const rows = computeStandings(state)
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
          <th>GD</th>
          <th>Pts</th>
          <th className="formCol">Form</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const t = teamById(state, r.teamId).identity
          return (
            <tr key={r.teamId} className={i < 4 ? 'playoff' : ''}>
              <td>{i + 1}</td>
              <td className="teamCol">
                <span className="chip" style={{ background: t.color }} />
                {t.abbr}
              </td>
              <td>{r.played}</td>
              <td>{r.won}</td>
              <td>{r.drawn}</td>
              <td>{r.lost}</td>
              <td>{r.gd > 0 ? '+' : ''}{r.gd}</td>
              <td className="pts">{r.points}</td>
              <td className="formCol">{r.form.join(' ')}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
