import { useMemo, useState } from 'react'
import {
  advanceGolfSeason,
  golferById,
  golfRecordRoundResult,
  golfSeasonComplete,
  playNextGolfRound,
  simGolfSeasonToEnd,
  ROUNDS_PER_EVENT,
  type GolfEventRecord,
  type GolfSeasonState,
} from '../league/golfSeason'
import { golfCourseById, eventById, golfMajors } from '../ratings/golfCourses'
import type { GolferRating } from '../sim/golfTypes'
import { GOLFERS, GOLF_TOUR } from '../ratings/golfers'
import { buildGolfRenderModel, type GolfRenderModel } from '../render/golfRenderMatch'
import { buildGolfPreviewModel, golfPreviewSeed } from '../render/golfCoursePreview'
import { exportGolfRankingsPng } from '../render/golfRankingsCard'
import { exportGolfLeaderboardPng } from '../render/golfLeaderboardCard'
import { golfStoryChips } from '../content/golfStorylines'
import { buildGolfEventPack, golfEventBrand } from '../content/golfEventPack'
import { buildGolfSeasonContent } from '../content/golfSeasonContent'
import type { MatchdayPack } from '../content/matchdayPack'
import { downloadBlob } from '../export/exportMp4'
import { GolfRoundView } from './GolfRoundView'
import { GolfPreviewView } from './GolfPreviewView'
import { GolfRankingsTable } from './GolfRankingsTable'
import { GolfFriendlyTab } from './GolfFriendlyTab'
import { PackPanel } from './PackPanel'

type GolfView = 'season' | 'friendly' | 'majors' | 'golfers'

/** The SGA home: the season calendar, the majors book + the golfer book. */
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
        <button className={view === 'majors' ? 'on' : ''} onClick={() => setView('majors')}>
          Majors
        </button>
        <button className={view === 'golfers' ? 'on' : ''} onClick={() => setView('golfers')}>
          Golfers
        </button>
      </nav>

      {view === 'season' && <GolfSeasonView state={state} setState={setState} onReset={onReset} />}
      {view === 'friendly' && <GolfFriendlyTab />}
      {view === 'majors' && <MajorsBook />}
      {view === 'golfers' && <GolferBook state={state} />}
    </div>
  )
}

/** The four majors, with their character write-ups + logo art direction. */
function MajorsBook() {
  const majors = golfMajors()
  return (
    <div>
      <p className="hint">
        The four crowns of the SGA Tour season — 4 rounds each, double ranking points, and their own courses on the calendar every year.
      </p>
      <div className="clubGrid">
        {majors.map((m) => (
          <div
            className="clubCard"
            key={m.id}
            style={{ borderTopColor: m.championship ? '#d4af37' : m.color }}
          >
            <div className="clubHead">
              <span className="chip big" style={{ background: m.color }} />
              <div>
                <b>{m.name}</b>
                <div className="nick">
                  🏆 {m.championship ? 'THE CHAMPIONSHIP · SEASON FINALE' : 'MAJOR'} · plays {m.short}
                </div>
              </div>
            </div>
            {m.description && <p>{m.description}</p>}
            <p className="stats">
              <b>Crest:</b> {m.logo.replace(/^MAJOR[^—]*—\s*/, '')}
            </p>
          </div>
        ))}
      </div>
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
  const [view, setView] = useState<{ eventId: string; field: GolferRating[]; toParByRound: number[][]; season: number } | null>(null)
  const [viewLabel, setViewLabel] = useState('')
  const [playKey, setPlayKey] = useState(0)
  const [pack, setPack] = useState<MatchdayPack | null>(null)
  const [packProgress, setPackProgress] = useState<string | null>(null)
  const [seasonBusy, setSeasonBusy] = useState<{ p: number; label: string } | null>(null)

  const done = golfSeasonComplete(state)
  const event = eventById(state.current.eventId)
  const course = golfCourseById(event.courseId)
  const nextRound = state.current.roundsPlayed + 1

  // The upcoming event's Tuesday course-preview flyover (title card + 9 holes).
  const previewModel = useMemo(() => {
    if (done) return null
    const seed = golfPreviewSeed(state.seedKey, state.season, state.current.eventIndex)
    return buildGolfPreviewModel(golfEventBrand(state.current.eventId), course, seed)
  }, [done, state.seedKey, state.season, state.current.eventIndex, state.current.eventId, course])

  async function downloadSeason(): Promise<void> {
    setSeasonBusy({ p: 0, label: 'simming the season' })
    try {
      const complete = simGolfSeasonToEnd(state)
      setState(complete)
      const zip = await buildGolfSeasonContent(complete, (p, label) => setSeasonBusy({ p, label }))
      downloadBlob(zip, `ESSPN-SGA-Tour-S${complete.season}.zip`)
    } catch (e) {
      window.alert('Season download failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSeasonBusy(null)
    }
  }

  function showRound(
    eventId: string,
    src: { field: GolferRating[]; toParByRound: number[][]; season: number },
    result: ReturnType<typeof golfRecordRoundResult>,
    chips: string[],
    label: string,
  ): void {
    const ev = eventById(eventId)
    const courseName = golfCourseById(ev.courseId).name
    const brand = golfEventBrand(eventId)
    setModels([
      buildGolfRenderModel(result, 0, brand, courseName, chips),
      buildGolfRenderModel(result, 1, brand, courseName, chips),
    ])
    setView({ eventId, ...src })
    setViewLabel(label)
    setPlayKey((k) => k + 1)
  }

  function playRound(): void {
    const chips = golfStoryChips(state)
    const eventId = state.current.eventId
    const out = playNextGolfRound(state)
    setState(out.state)
    // the just-played round lives in the ongoing event, or the last record if it finished it
    const finished = out.state.completed.length > state.completed.length
    const src = finished ? out.state.completed[out.state.completed.length - 1] : out.state.current
    showRound(
      eventId,
      { field: src.field, toParByRound: src.toParByRound, season: state.season },
      out.result,
      chips,
      `${event.short} · Round ${out.result.config.round}`,
    )
    setPack(null)
  }

  function watchPast(record: GolfEventRecord, round: number): void {
    const ev = eventById(record.eventId)
    showRound(
      record.eventId,
      { field: record.field, toParByRound: record.toParByRound, season: record.season },
      golfRecordRoundResult(state, record, round),
      [],
      `${ev.short} · Round ${round} (replay)`,
    )
  }

  async function downloadRankingsPng(): Promise<void> {
    const png = await exportGolfRankingsPng(state)
    downloadBlob(png, `esspn-golf-rankings-s${state.season}.png`)
  }

  async function downloadLeaderboardPng(throughRound: number): Promise<void> {
    if (!view) return
    const ev = eventById(view.eventId)
    const png = await exportGolfLeaderboardPng({
      event: ev,
      season: view.season,
      field: view.field,
      toParByRound: view.toParByRound.slice(0, throughRound),
    })
    downloadBlob(png, `esspn-golf-${ev.short.replace(/\s/g, '').toLowerCase()}-r${throughRound}-leaderboard.png`)
  }

  async function buildPack(record: GolfEventRecord): Promise<void> {
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

      <h3 className="sectionH">📦 Full-season content</h3>
      <p className="hint">
        One click sims the rest of the season and downloads a .zip organised by tournament and by
        round — each event's Tuesday course-preview carousel (10 images), then Rounds 1–4 (Thu–Sun)
        with both group videos and the leaderboard, plus the season rankings card. It encodes over
        100 videos in your browser, so it can take several minutes.
      </p>
      <div className="controls">
        <button className="btn" onClick={() => void downloadSeason()} disabled={seasonBusy !== null}>
          {seasonBusy
            ? `Building… ${Math.round(seasonBusy.p * 100)}% · ${seasonBusy.label}`
            : '⬇ Sim & Download Full Season'}
        </button>
      </div>

      {previewModel && (
        <>
          <h3 className="sectionH">🎬 Course preview — {event.name}</h3>
          <p className="hint">
            A 10-image carousel to post on Tuesday: the title card + all 9 holes of {course.name}{' '}
            (par {course.par}). The rounds play Thursday–Sunday.
          </p>
          <GolfPreviewView
            model={previewModel}
            filename={`esspn-golf-${event.short.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-course-preview.zip`}
            playKey={state.current.eventIndex}
          />
        </>
      )}

      {models && (
        <>
          <p className="hint">{viewLabel} — every shot, all 9 holes. BOTH foursomes below.</p>
          <div className="controls">
            <button
              className="btn ghost"
              onClick={() => void downloadLeaderboardPng(models[0].m.config.round)}
            >
              ⬇ Round leaderboard PNG
            </button>
          </div>
          {([0, 1] as const).map((grp) => (
            <div key={grp}>
              <h3>
                {grp === 0 ? '⛳ Group 1' : `🏁 Group 2${models[1].m.config.round > 1 ? ' (leaders)' : ''}`}
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
              const e = eventById(r.eventId)
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
                          onClick={() => watchPast(r, round)}
                        >
                          R{round}
                        </button>
                      ))}
                      <button
                        className="btn ghost small2"
                        onClick={() => void buildPack(r)}
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
