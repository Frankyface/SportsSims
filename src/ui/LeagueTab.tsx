import { useState } from 'react'
import type { LeagueState } from '../league/types'
import {
  teamById,
  playRound,
  startPlayoffs,
  advancePlayoffs,
  playFixture,
  seasonComplete,
  advanceSeason,
  fixtureMatch,
  winnerOf,
} from '../league/league'
import { buildMatchdayPack, type MatchdayPack } from '../content/matchdayPack'
import { StandingsTable } from './StandingsTable'
import { MatchView } from './MatchView'
import { PackPanel } from './PackPanel'

export function LeagueTab({ state, setState }: { state: LeagueState; setState: (s: LeagueState) => void }) {
  const [picked, setPicked] = useState<string | null>(null)
  const [viewNo, setViewNo] = useState(0)
  const [pack, setPack] = useState<MatchdayPack | null>(null)
  const [packProg, setPackProg] = useState<{ p: number; label: string } | null>(null)

  const regularRounds = [...new Set(state.fixtures.filter((f) => f.stage === 'regular').map((f) => f.round))].sort((a, b) => a - b)
  const nextRegularRound = regularRounds.find((r) =>
    state.fixtures.some((f) => f.round === r && f.stage === 'regular' && !state.results[f.id]),
  )

  function roundName(r: number): string {
    const f = state.fixtures.find((x) => x.round === r)
    if (f?.stage === 'final') return 'The Final'
    if (f?.stage === 'sf') return 'Playoff Semis'
    return `Matchday ${r + 1}`
  }

  const playedRoundsFull = [...new Set(state.fixtures.filter((f) => state.results[f.id]).map((f) => f.round))]
    .filter((r) => state.fixtures.filter((f) => f.round === r).every((f) => state.results[f.id]))
    .sort((a, b) => a - b)
  const latestPlayedRound = playedRoundsFull.length ? playedRoundsFull[playedRoundsFull.length - 1] : undefined

  function pick(id: string) {
    setPicked(id)
    setViewNo((v) => v + 1)
  }

  function simNext() {
    if (nextRegularRound !== undefined) {
      setState(playRound(state, nextRegularRound))
    } else if (state.phase === 'regular') {
      setState(startPlayoffs(state))
    } else if (state.phase === 'playoffs') {
      let s = state
      if (!s.results['sf1']) s = playFixture(s, 'sf1')
      else if (!s.results['sf2']) s = playFixture(s, 'sf2')
      else {
        s = advancePlayoffs(s)
        if (!s.results['final']) s = playFixture(s, 'final')
      }
      setState(s)
    }
  }

  function simSeason() {
    let s = state
    for (const r of regularRounds) s = playRound(s, r)
    if (s.phase === 'regular') s = startPlayoffs(s)
    if (!s.results['sf1']) s = playFixture(s, 'sf1')
    if (!s.results['sf2']) s = playFixture(s, 'sf2')
    s = advancePlayoffs(s)
    if (!s.results['final']) s = playFixture(s, 'final')
    setState(s)
  }

  async function producePack(round: number) {
    setPack(null)
    setPackProg({ p: 0, label: 'starting' })
    try {
      const p = await buildMatchdayPack(state, round, (prog, label) => setPackProg({ p: prog, label }))
      setPack(p)
    } catch (e) {
      window.alert('Pack failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setPackProg(null)
    }
  }

  const played = state.fixtures.filter((f) => state.results[f.id]).sort((a, b) => b.round - a.round)
  const champion = seasonComplete(state) ? teamById(state, winnerOf(state, 'final')).identity : null

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
        <h2>{state.name}</h2>
        <span className="sub">
          Season {state.season} · {state.phase}
          {champion ? ` · 🏆 ${champion.name}` : ''}
        </span>
      </div>

      <div className="controls">
        {!seasonComplete(state) && (
          <button className="btn" onClick={simNext}>
            {nextLabel}
          </button>
        )}
        {!seasonComplete(state) && (
          <button className="btn ghost" onClick={simSeason}>
            Sim full season
          </button>
        )}
        {seasonComplete(state) && (
          <button
            className="btn"
            onClick={() => {
              setState(advanceSeason(state))
              setPicked(null)
              setPack(null)
            }}
          >
            Start season {state.season + 1} ▸
          </button>
        )}
      </div>

      <StandingsTable state={state} />

      {pickedF && pickedSc && (
        <div className="matchPanel">
          <h3>
            <span style={{ color: teamById(state, pickedF.home).identity.color }}>{teamById(state, pickedF.home).identity.abbr}</span>{' '}
            {pickedSc.home}–{pickedSc.away}{' '}
            <span style={{ color: teamById(state, pickedF.away).identity.color }}>{teamById(state, pickedF.away).identity.abbr}</span>
            <span className="sub"> · {pickedF.stage === 'regular' ? `Matchday ${pickedF.round + 1}` : pickedF.stage.toUpperCase()}</span>
          </h3>
          <MatchView match={fixtureMatch(state, pickedF.id)} filename={`esspn-s${state.season}-${pickedF.id}.mp4`} playKey={viewNo} />
          <button className="btn ghost" onClick={() => setPicked(null)}>
            Close
          </button>
        </div>
      )}

      <h3 className="sectionH">🎬 Matchday content pack</h3>
      {latestPlayedRound === undefined ? (
        <p className="hint">Sim a round first — then produce a ready-to-post pack (a video per game + a standings post + captions).</p>
      ) : (
        <>
          <div className="controls">
            <button className="btn" onClick={() => producePack(latestPlayedRound)} disabled={packProg !== null}>
              {packProg ? `Producing… ${Math.round(packProg.p * 100)}% · ${packProg.label}` : `Produce ${roundName(latestPlayedRound)} pack`}
            </button>
          </div>
          {pack && <PackPanel pack={pack} />}
        </>
      )}

      <h3 className="sectionH">Results — tap to watch &amp; export</h3>
      <ul className="results">
        {played.slice(0, 24).map((f) => {
          const sc = state.results[f.id]!
          const h = teamById(state, f.home).identity
          const a = teamById(state, f.away).identity
          return (
            <li key={f.id} className={picked === f.id ? 'sel' : ''} onClick={() => pick(f.id)}>
              <span className="rd">{f.stage === 'regular' ? `MD${f.round + 1}` : f.stage.toUpperCase()}</span>
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
