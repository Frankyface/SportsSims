// Builds the evergreen "club card" set — one 1080x1350 Instagram identity card
// per club, plus a ready-to-paste caption. Posted once as a season-launch series
// (a "meet the clubs" carousel), not per matchday — so it's its own download,
// separate from the matchday content pack.

import type { ClubDef } from '../ratings/teams'
import { CLUBS } from '../ratings/teams'
import { RUGBY_CLUBS } from '../ratings/rugbyTeams'
import { ensureLogosLoaded, getLeagueLogo, getLogo } from '../render/logos'
import { ensureRugbyLogosLoaded, getBastionLogo, getRugbyLogo } from '../render/rugbyLogos'
import { exportTeamCardPng, type TeamCardBrand, type TeamCardInput } from '../render/teamCard'
import { BASTION, CROWN } from '../render/theme'
import { FILE_PREFIX } from '../brand'

export interface ClubCard {
  abbr: string
  name: string
  file: string // download filename
  blob: Blob
  caption: string
}

export type CardProgress = (p: number, label: string) => void

function clubCaption(club: ClubDef, competitionName: string, tags: string): string {
  return [
    `${club.name} — “${club.nickname}”`,
    `${club.city} · ${club.archetype}`,
    '',
    club.description,
    '',
    `${competitionName} · Club Identity`,
    tags,
  ].join('\n')
}

async function buildCards(
  clubs: ClubDef[],
  crestOf: (id: string) => HTMLImageElement | undefined,
  brand: TeamCardBrand,
  tags: string,
  onProgress?: CardProgress,
): Promise<ClubCard[]> {
  const out: ClubCard[] = []
  for (let i = 0; i < clubs.length; i++) {
    const c = clubs[i]
    onProgress?.(i / clubs.length, c.abbr)
    const input: TeamCardInput = {
      name: c.name,
      abbr: c.abbr,
      city: c.city,
      nickname: c.nickname,
      archetype: c.archetype,
      color: c.color,
      colorAlt: c.colorAlt,
      description: c.description,
      crest: crestOf(c.id) ?? null,
    }
    const blob = await exportTeamCardPng(input, brand)
    out.push({
      abbr: c.abbr,
      name: c.name,
      file: fileNameFor(brand.competitionName, c.abbr),
      blob,
      caption: clubCaption(c, brand.competitionName, tags),
    })
  }
  onProgress?.(1, 'done')
  return out
}

export function fileNameFor(competitionName: string, abbr: string): string {
  return `${FILE_PREFIX}-${competitionName.replace(/\s/g, '')}-card-${abbr}.png`
}

export async function buildSoccerClubCards(onProgress?: CardProgress): Promise<ClubCard[]> {
  await ensureLogosLoaded()
  return buildCards(
    CLUBS,
    getLogo,
    { competition: CROWN, competitionName: 'Crown League', logo: getLeagueLogo() ?? null },
    '#CrownLeague #SimSoccer',
    onProgress,
  )
}

export async function buildRugbyClubCards(onProgress?: CardProgress): Promise<ClubCard[]> {
  await ensureRugbyLogosLoaded()
  return buildCards(
    RUGBY_CLUBS,
    getRugbyLogo,
    { competition: BASTION, competitionName: 'Bastion Championships', logo: getBastionLogo() ?? null },
    '#BastionChampionships #SimRugby',
    onProgress,
  )
}
