import { golferById, golfRankings, type GolfSeasonState } from '../league/golfSeason'
import { GOLF_SCHEDULE } from '../ratings/golfCourses'

/** The Apex Tour season rankings, on-page. Majors pay double points. */
export function GolfRankingsTable({ state }: { state: GolfSeasonState }) {
  const rankings = golfRankings(state)
  return (
    <table className="standings">
      <thead>
        <tr>
          <th>#</th>
          <th className="teamCol">Golfer</th>
          <th>Wins</th>
          <th>Majors</th>
          <th>Top 3</th>
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>
        {rankings.map((r, i) => {
          const g = golferById(state, r.golferId)
          const majors = state.completed.filter(
            (rec) => rec.winnerId === r.golferId && GOLF_SCHEDULE[rec.eventIndex].major,
          ).length
          const top3 = state.completed.filter((rec) => rec.finishOrder.indexOf(r.golferId) <= 2).length
          return (
            <tr key={r.golferId} className={i === 0 ? 'playoff' : ''}>
              <td>{i + 1}</td>
              <td className="teamCol">
                <span className="chip" style={{ background: g.identity.color }} /> {g.identity.name}
              </td>
              <td>{r.wins}</td>
              <td>{majors}</td>
              <td>{top3}</td>
              <td className="pts">{r.points}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
