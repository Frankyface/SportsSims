// The storyline engine — turns the Apex Tour's career stats book into the
// drama hooks that open every round video and lead the captions. Deterministic:
// same season state + round → same chips, so re-renders match.
//
// Priority order tells the broadcast truth: a blown-lead ghost or a maiden-win
// chance beats a generic points-race line.

import {
  golferById,
  golfRankings,
  ROUNDS_PER_EVENT,
  type GolfSeasonState,
} from '../league/golfSeason'
import { eventById } from '../ratings/golfCourses'
import { formatToPar } from '../render/golfDirector'

interface Chip {
  priority: number
  text: string
}

function surname(name: string): string {
  return (name.split(' ').pop() ?? name).toUpperCase()
}

/**
 * 0-2 intro storyline chips for the NEXT round of the current event.
 * Reads the career book + the event standings; never invents facts.
 */
export function golfStoryChips(state: GolfSeasonState): string[] {
  const ev = state.current
  const event = eventById(ev.eventId)
  const round = ev.roundsPlayed + 1
  const chips: Chip[] = []

  // --- event-standings drama (rounds 2-4) ---
  if (round > 1) {
    const totals = ev.totalToPar
    const order = state.golfers.map((_, i) => i).sort((a, b) => totals[a] - totals[b] || a - b)
    const leadIdx = order[0]
    const gap = totals[order[1]] - totals[leadIdx]
    const leader = state.golfers[leadIdx]
    const leaderCareer = state.career[leader.identity.id]
    if (round === ROUNDS_PER_EVENT) {
      if (gap === 0) {
        chips.push({ priority: 9, text: `FINAL ROUND — TIED AT THE TOP AT ${formatToPar(totals[leadIdx])}` })
      } else {
        chips.push({
          priority: 8,
          text: `${surname(leader.identity.name)} LEADS BY ${gap} — 9 TO PLAY`,
        })
      }
      if (gap >= 0 && leaderCareer.blownLeads >= 2) {
        chips.push({
          priority: 9,
          text: `${surname(leader.identity.name)} HAS BLOWN ${leaderCareer.blownLeads} FINAL-ROUND LEADS`,
        })
      }
      if (leaderCareer.wins === 0 && leaderCareer.starts >= 4) {
        chips.push({ priority: 10, text: `${surname(leader.identity.name)} CHASES A FIRST CAREER WIN` })
      }
    } else {
      chips.push({
        priority: 4,
        text:
          gap === 0
            ? `ROUND ${round} — ALL SQUARE AT THE TOP`
            : `${surname(leader.identity.name)} LEADS ON ${formatToPar(totals[leadIdx])}`,
      })
    }
  }

  // --- career-book drama (any round; strongest for round 1 intros) ---
  const rankings = golfRankings(state)
  for (const g of state.golfers) {
    const id = g.identity.id
    const c = state.career[id]
    if (event.major && c.majorWins === 0 && c.wins >= 2) {
      chips.push({ priority: event.championship ? 8 : 7, text: `${surname(g.identity.name)}: ${c.wins} WINS, STILL NO MAJOR` })
    }
    if (c.winlessStreak >= 8) {
      chips.push({ priority: 6, text: `${surname(g.identity.name)} — ${c.winlessStreak} STARTS WITHOUT A WIN` })
    }
  }
  // defending form: last event's winner
  const last = state.completed[state.completed.length - 1]
  if (last && round === 1) {
    const w = golferById(state, last.winnerId)
    const wc = state.career[last.winnerId]
    const streakWins = [...state.completed].reverse().findIndex((r) => r.winnerId !== last.winnerId)
    const consec = streakWins === -1 ? state.completed.length : streakWins
    if (consec >= 2) {
      chips.push({ priority: 9, text: `${surname(w.identity.name)} HUNTS ${consec + 1} WINS IN A ROW` })
    } else {
      chips.push({ priority: 5, text: `${surname(w.identity.name)} ARRIVES OFF A WIN${wc.wins >= 5 ? ` (#${wc.wins})` : ''}` })
    }
  }
  // the season race, late in the year
  if (ev.eventIndex >= 10 && round === 1 && rankings.length > 1) {
    const gap = rankings[0].points - rankings[1].points
    const leader = golferById(state, rankings[0].golferId)
    chips.push({
      priority: event.championship ? 8 : 5,
      text:
        gap <= GOLF_POINT_SWING
          ? `SEASON RACE ALIVE — ${surname(leader.identity.name)} LEADS BY ${gap} PTS`
          : `${surname(leader.identity.name)} CLOSES ON THE SEASON TITLE`,
    })
  }
  if (event.championship && round === 1) {
    chips.push({ priority: 7, text: 'THE FINAL MAJOR — EVERYTHING ENDS HERE' })
  }

  return chips
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
    .map((c) => c.text)
}

/** A points gap a single event can flip (winner 500/1000 vs runner-up 300/600). */
const GOLF_POINT_SWING = 400
