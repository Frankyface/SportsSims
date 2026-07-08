import { useState } from 'react'
import {
  advanceRugbyPlayoffs,
  advanceRugbySeason,
  playRugbyFixture,
  playRugbyRound,
  rugbyFixtureMatch,
  rugbySeasonComplete,
  rugbyTeamById,
  rugbyWinnerOf,
  startRugbyPlayoffs,
  type RugbyLeagueState,
} from '../league/rugbyLeague'
import { buildRugbyMatchdayPack } from '../content/rugbyMatchdayPack'
import type { MatchdayPack } from '../content/matchdayPack'
import { bastionLogoUrl } from '../render/rugbyLogos'
import { RugbyStandingsTable } from './RugbyStandingsTable'
import { RugbyMatchView } from './RugbyMatchView'
import { PackPanel } from './PackPanel'

/** The persistent Bastion Championships season — mirrors LeagueTab (soccer). */
export function RugbyLeagueTab({
  state,
  setState,
}: {
  state: RugbyLeagueState
  setState: (s: RugbyLeagueState) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const [viewNo, setViewNo] = useState(0)
  const [pack, setPack] = useState<MatchdayPack | null>(null)
  const [packProg, setPackProg] = useState<{ p: number; label: string } | null>(null)

  const regularRounds = [
    ...new Set(state.fixtures.filter((f) => f.stage === 'regular').map((f) => f.round)),
  ].sort((a, b) => a - b)
  const nextRegularRound = regularRounds.find((r) =>
    state.fixtures.some((f) => f.round === r && f.stage === 'regular' && !state.results[f.id]),
  )

  function roundName(r: number): string {
    const f = state.fixtures.find((x) => x.round === r)
    if (f?.stage === 'final') return 'The Final'
    if (f?.stage === 'sf') return 'Playoff Semis'
    return `Round ${r + 1}`
  }

  const playedRoundsFull = [
    ...new Set(state.fixtures.filter((f) => state.results[f.id]).map((f) => f.round)),
  ]
    .filter((r) => state.fixtures.filter((f) => f.round === r).every((f) => state.results[f.id]))
    .sort((a, b) => a - b)
  const latestPlayedRound = playedRoundsFull.length
    ? playedRoundsFull[playedRoundsFull.length - 1]
    : undefined

  function pick(id: string) {
    setPicked(id)
    setViewNo((v) => v + 1)
  }

  function simNext() {
    if (nextRegularRound !== undefined) {
      setState(playRugbyRound(state, nextRegularRound))
    } else if (state.phase === 'regular') {
      setState(startRugbyPlayoffs(state))
    } else if (state.phase === 'playoffs') {
      let s = state
      if (!s.results['sf1']) s = playRugbyFixture(s, 'sf1')
      else if (!s.results['sf2']) s = playRugbyFixture(s, 'sf2')
      else {
        s = advanceRugbyPlayoffs(s)
        if (!s.results['final']) s = playRugbyFixture(s, 'final')
      }
      setState(s)
    }
  }

  function simSeason() {
    let s = state
    for (const r of regularRounds) s = playRugbyRound(s, r)
    if (s.phase === 'regular') s = startRugbyPlayoffs(s)
    if (!s.results['sf1']) s = playRugbyFixture(s, 'sf1')
    if (!s.results['sf2']) s = playRugbyFixture(s, 'sf2')
    s = advanceRugbyPlayoffs(s)
    if (!s.results['final']) s = playRugbyFixture(s, 'final')
    setState(s)
  }

  async function producePack(round: number) {
    setPack(null)
    setPackProg({ p: 0, label: 'starting' })
    try {
      const p = await buildRugbyMatchdayPack(state, round, (prog, label) => setPackProg({ p: prog, label }))
      setPack(p)
    } catch (e) {
      window.alert('Pack failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setPackProg(null)
    }
  }

  const played = state.fixtures.filter((f) => state.results[f.id]).sort((a, b) => b.round - a.round)
  const champion = rugbySeasonComplete(state)
    ? rugbyTeamById(state, rugbyWinnerOf(state, 'final')).identity
    : null

  const pickedF = picked ? state.fixtures.find((x) => x.id === picked) : undefined
  const pickedSc = picked ? state.results[picked] : undefined

  const nextLabel =
    state.phase === 'regular'
      ? nextRegularRound !== undefined
        ? `Sim round ${nextRegularRound + 1}`
        : 'Start playoffs'
      : 'Sim next tie'

  return (
    <div>
      <div className="leagueHead">
        <img className="league-logo" src={bastionLogoUrl} alt="Bastion Championships" />
        <div>
          <h2>{state.name}</h2>
          <span className="sub">
            Season {state.season} · {state.phase}
            {champion ? ` · 🏆 ${champion.name}` : ''}
          </span>
        </div>
      </div>

      {state.offseasonBig && state.offseasonBig.length > 0 && (
        <div className="offseason">
          🔁 <b>Big offseason:</b>{' '}
          {state.offseasonBig.map((id) => rugbyTeamById(state, id).identity.name).join(', ')} — reshaped
          squads, expect them to swing this season.
        </div>
      )}

      <div className="controls">
        {!rugbySeasonComplete(state) && (
          <button className="btn" onClick={simNext}>
            {nextLabel}
          </button>
        )}
        {!rugbySeasonComplete(state) && (
          <button className="btn ghost" onClick={simSeason}>
            Sim full season
          </button>
        )}
        {rugbySeasonComplete(state) && (
          <button
            className="btn"
            onClick={() => {
              setState(advanceRugbySeason(state))
              setPicked(null)
              setPack(null)
            }}
          >
            Start season {state.season + 1} ▸
          </button>
        )}
      </div>

      <RugbyStandingsTable state={state} />
      <p className="hint">4 pts a win, 2 a draw · +1 for 4+ tries · +1 for losing by 7 or less.</p>

      {pickedF && pickedSc && (
        <div className="matchPanel">
          <h3>
            <span style={{ color: rugbyTeamById(state, pickedF.home).identity.color }}>
              {rugbyTeamById(state, pickedF.home).identity.abbr}
            </span>{' '}
            {pickedSc.home}–{pickedSc.away}{' '}
            <span style={{ color: rugbyTeamById(state, pickedF.away).identity.color }}>
              {rugbyTeamById(state, pickedF.away).identity.abbr}
            </span>
            <span className="sub">
              {' '}
              · {pickedF.stage === 'regular' ? `Round ${pickedF.round + 1}` : pickedF.stage.toUpperCase()}
            </span>
          </h3>
          <RugbyMatchView
            match={rugbyFixtureMatch(state, pickedF.id)}
            filename={`esspn-rugby-s${state.season}-${pickedF.id}.mp4`}
            playKey={viewNo}
          />
          <button className="btn ghost" onClick={() => setPicked(null)}>
            Close
          </button>
        </div>
      )}

      <h3 className="sectionH">🎬 Round content pack</h3>
      {latestPlayedRound === undefined ? (
        <p className="hint">
          Sim a round first — then produce a ready-to-post pack (a video per game + a standings post +
          captions).
        </p>
      ) : (
        <>
          <div className="controls">
            <button className="btn" onClick={() => producePack(latestPlayedRound)} disabled={packProg !== null}>
              {packProg
                ? `Producing… ${Math.round(packProg.p * 100)}% · ${packProg.label}`
                : `Produce ${roundName(latestPlayedRound)} pack`}
            </button>
          </div>
          {pack && <PackPanel pack={pack} />}
        </>
      )}

      <h3 className="sectionH">Results — tap to watch &amp; export</h3>
      <ul className="results">
        {played.slice(0, 24).map((f) => {
          const sc = state.results[f.id]
          const h = rugbyTeamById(state, f.home).identity
          const a = rugbyTeamById(state, f.away).identity
          return (
            <li key={f.id} className={picked === f.id ? 'sel' : ''} onClick={() => pick(f.id)}>
              <span className="rd">{f.stage === 'regular' ? `R${f.round + 1}` : f.stage.toUpperCase()}</span>
              <span className="chip" style={{ background: h.color }} />
              {h.abbr}
              <b>
                {sc.home}–{sc.away}
              </b>
              {a.abbr}
              <span className="chip" style={{ background: a.color }} />
            </li>
          )
        })}
        {played.length === 0 && <li className="empty">No matches played yet — hit “{nextLabel}”.</li>}
      </ul>
    </div>
  )
}
