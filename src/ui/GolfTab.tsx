import { useState } from 'react'
import {
  advanceGolfSeason,
  golferById,
  golfRecordRoundResult,
  golfSeasonComplete,
  playNextGolfRound,
  ROUNDS_PER_EVENT,
  type GolfSeasonState,
} from '../league/golfSeason'
import { golfCourseById, golfEventByIndex } from '../ratings/golfCourses'
import { GOLFERS, GOLF_TOUR } from '../ratings/golfers'
import { buildGolfRenderModel, type GolfRenderModel } from '../render/golfRenderMatch'
import { exportGolfRankingsPng } from '../render/golfRankingsCard'
import { exportGolfLeaderboardPng } from '../render/golfLeaderboardCard'
import { golfStoryChips } from '../content/golfStorylines'
import { buildGolfEventPack, golfEventBrand } from '../content/golfEventPack'
import type { MatchdayPack } from '../content/matchdayPack'
import { downloadBlob } from '../export/exportMp4'
import { GolfRoundView } from './GolfRoundView'
import { GolfRankingsTable } from './GolfRankingsTable'
import { GolfFriendlyTab } from './GolfFriendlyTab'
import { PackPanel } from './PackPanel'

type GolfView = 'season' | 'friendly' | 'golfers'

/** The Apex Tour home: the season calendar + the golfer book. */
export function GolfTab({
  state,
  setState,
  onReset,
}: {
  state: GolfSeasonState
  setState: (s: GolfSeasonState) => void
  onReset: () => void
}) {
  const [view, setView] = useState<GolfView>('season')

  return (
    <div>
      <nav className="tabs sub">
        <button className={view === 'season' ? 'on' : ''} onClick={() => setView('season')}>
          Season
        </button>
        <button className={view === 'friendly' ? 'on' : ''} onClick={() => setView('friendly')}>
          Friendly
        </button>
        <button className={view === 'golfers' ? 'on' : ''} onClick={() => setView('golfers')}>
          Golfers
        </button>
      </nav>

      {view === 'season' && <GolfSeasonView state={state} setState={setState} onReset={onReset} />}
      {view === 'friendly' && <GolfFriendlyTab />}
      {view === 'golfers' && <GolferBook state={state} />}
    </div>
  )
}

function GolfSeasonView({
  state,
  setState,
  onReset,
}: {
  state: GolfSeasonState
  setState: (s: GolfSeasonState) => void
  onReset: () => void
}) {
  const [models, setModels] = useState<[GolfRenderModel, GolfRenderModel] | null>(null)
  const [viewEventIndex, setViewEventIndex] = useState(0)
  const [viewLabel, setViewLabel] = useState('')
  const [playKey, setPlayKey] = useState(0)
  const [pack, setPack] = useState<MatchdayPack | null>(null)
  const [packProgress, setPackProgress] = useState<string | null>(null)

  const done = golfSeasonComplete(state)
  const event = golfEventByIndex(state.current.eventIndex)
  const course = golfCourseById(event.courseId)
  const nextRound = state.current.roundsPlayed + 1

  function showRound(
    eventIndex: number,
    result: ReturnType<typeof golfRecordRoundResult>,
    chips: string[],
    label: string,
  ): void {
    const ev = golfEventByIndex(eventIndex)
    const courseName = golfCourseById(ev.courseId).name
    const brand = golfEventBrand(eventIndex)
    setModels([
      buildGolfRenderModel(result, 0, brand, courseName, chips),
      buildGolfRenderModel(result, 1, brand, courseName, chips),
    ])
    setViewEventIndex(eventIndex)
    setViewLabel(label)
    setPlayKey((k) => k + 1)
  }

  function playRound(): void {
    const chips = golfStoryChips(state)
    const eventIndex = state.current.eventIndex
    const out = playNextGolfRound(state)
    setState(out.state)
    showRound(eventIndex, out.result, chips, `${event.short} · Round ${out.result.config.round}`)
    setPack(null)
  }

  function watchPast(eventIndex: number, round: number): void {
    const record = state.completed.find((r) => r.eventIndex === eventIndex)
    if (!record) return
    const ev = golfEventByIndex(eventIndex)
    showRound(
      eventIndex,
      golfRecordRoundResult(state, record, round),
      [],
      `${ev.short} · Round ${round} (replay)`,
    )
  }

  async function downloadRankingsPng(): Promise<void> {
    const png = await exportGolfRankingsPng(state)
    downloadBlob(png, `esspn-golf-rankings-s${state.season}.png`)
  }

  async function downloadLeaderboardPng(eventIndex: number, throughRound: number): Promise<void> {
    const ev = golfEventByIndex(eventIndex)
    const record = state.completed.find((r) => r.eventIndex === eventIndex)
    const src = record ?? (state.current.eventIndex === eventIndex ? state.current : null)
    if (!src) return
    const png = await exportGolfLeaderboardPng({
      event: ev,
      season: record?.season ?? state.season,
      field: src.field,
      toParByRound: src.toParByRound.slice(0, throughRound),
    })
    downloadBlob(png, `esspn-golf-${ev.short.replace(/\s/g, '').toLowerCase()}-r${throughRound}-leaderboard.png`)
  }

  async function buildPack(eventIndex: number): Promise<void> {
    const record = state.completed.find((r) => r.eventIndex === eventIndex)
    if (!record) return
    setPackProgress('starting…')
    try {
      const p = await buildGolfEventPack(state, record, (prog, label) =>
        setPackProgress(`${Math.round(prog * 100)}% — ${label}`),
      )
      setPack(p)
    } finally {
      setPackProgress(null)
    }
  }

  return (
    <div>
      {!done && (
        <div className="controls" style={{ flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <div>
            <b style={{ color: event.color === '#14141a' ? event.colorAlt : event.color }}>
              {event.major ? '🏆 ' : ''}
              {event.name}
            </b>{' '}
            — {course.name} ({course.env}) · Event {state.current.eventIndex + 1}/14
            {event.major ? ' · MAJOR (double points)' : ''}
          </div>
          <button className="btn" onClick={playRound}>
            ⛳ Play Round {nextRound} of {ROUNDS_PER_EVENT} ▸
          </button>
        </div>
      )}
      {done && (
        <div className="controls">
          <b>Season {state.season} complete.</b>
          <button className="btn" onClick={() => setState(advanceGolfSeason(state))}>
            Start Season {state.season + 1} ▸
          </button>
        </div>
      )}

      {models && (
        <>
          <p className="hint">{viewLabel} — every shot, all 9 holes. BOTH foursomes below.</p>
          <div className="controls">
            <button
              className="btn ghost"
              onClick={() => void downloadLeaderboardPng(viewEventIndex, models[0].m.config.round)}
            >
              ⬇ Round leaderboard PNG
            </button>
          </div>
          {([0, 1] as const).map((grp) => (
            <div key={grp}>
              <h3>
                {grp === 0 ? '⛳ Group 1' : `🏁 Final group${models[1].m.config.round > 1 ? ' (leaders)' : ''}`}
              </h3>
              <GolfRoundView
                model={models[grp]}
                filename={`esspn-golf-${viewLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-g${grp + 1}.mp4`}
                playKey={playKey * 2 + grp}
              />
            </div>
          ))}
        </>
      )}

      <h3>Rankings — Season {state.season}</h3>
      <GolfRankingsTable state={state} />
      <div className="controls">
        <button className="btn ghost" onClick={() => void downloadRankingsPng()}>
          ⬇ Rankings card PNG
        </button>
      </div>

      {state.completed.length > 0 && (
        <>
          <h3>Completed events</h3>
          <ul className="packItems">
            {state.completed.map((r) => {
              const e = golfEventByIndex(r.eventIndex)
              const w = golferById(state, r.winnerId)
              return (
                <li key={r.eventIndex}>
                  <div className="packRow">
                    <span>
                      {e.major ? '🏆' : '⛳'} <b>{e.name}</b> — {w.identity.name} wins
                      {r.wireToWire ? ' (wire to wire)' : r.comeback ? ' (comeback)' : ''}
                    </span>
                    <span>
                      {[1, 2, 3, 4].map((round) => (
                        <button
                          key={round}
                          className="btn ghost small2"
                          onClick={() => watchPast(r.eventIndex, round)}
                        >
                          R{round}
                        </button>
                      ))}
                      <button
                        className="btn ghost small2"
                        onClick={() => void buildPack(r.eventIndex)}
                        disabled={packProgress !== null}
                      >
                        {packProgress ?? '📦 Pack'}
                      </button>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {pack && <PackPanel pack={pack} />}

      <button className="btn ghost small" onClick={onReset}>
        Reset tour
      </button>
    </div>
  )
}

/** Read-only golfer book: the Apex Tour field, bios + the career stats book. */
function GolferBook({ state }: { state: GolfSeasonState }) {
  return (
    <div>
      <p className="hint">
        {GOLF_TOUR.tagline} · {GOLFERS.length} golfers · 14 events · 4 majors
      </p>
      <div className="clubGrid">
        {GOLFERS.map((g) => {
          const tour = state.golfers.find((x) => x.identity.id === g.id)
          const c = state.career[g.id]
          return (
            <div className="clubCard" key={g.id}>
              <div className="clubHead">
                <span className="chip big" style={{ background: g.color }} />
                <div>
                  <b>{g.name}</b>
                  <div className="nick">
                    “{g.nickname}” · {g.archetype}
                  </div>
                </div>
              </div>
              <p>{g.description}</p>
              {tour && c && (
                <p className="stats">
                  Rating {Math.round(tour.glicko.rating)} · {c.wins} wins ({c.majorWins} majors) ·{' '}
                  {c.top3s} top-3s
                  {c.blownLeads > 0 ? ` · ${c.blownLeads} blown leads` : ''}
                  {c.winlessStreak >= 8 ? ` · ${c.winlessStreak} starts since a win` : ''}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
