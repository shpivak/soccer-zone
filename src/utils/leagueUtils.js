import { APP_CONFIG } from '../config'

export const LEAGUE_TYPES = {
  tournament: 'tournament',
  regular: 'regular',
  friendly: 'friendly',
}

const typeLabels = {
  [LEAGUE_TYPES.tournament]: 'ליגת טורנירים',
  [LEAGUE_TYPES.regular]: 'ליגה סדירה',
  [LEAGUE_TYPES.friendly]: 'משחקי ידידות',
}

const modeLabels = {
  [LEAGUE_TYPES.tournament]: {
    liveTitle: 'ניהול טורניר חי',
    empty: 'אין טורניר זמין. ניתן ליצור טורניר חדש.',
    create: 'צור טורניר',
    createAnother: 'טורניר חדש',
    selectLabel: 'טורניר',
    scheduleLabel: 'משחקים בטורניר',
    statsTitle: 'סטטיסטיקות כלל הטורנירים',
    maxGamesMessage: (count) => `אי אפשר להוסיף יותר מ-${count} משחקים לטורניר.`,
  },
  [LEAGUE_TYPES.regular]: {
    liveTitle: 'ניהול מחזור ליגה',
    empty: 'אין מחזור זמין. ניתן ליצור מחזור חדש.',
    create: 'צור מחזור',
    createAnother: 'מחזור חדש',
    selectLabel: 'מחזור',
    scheduleLabel: 'משחקים במחזור',
    statsTitle: 'טבלת ליגה וראשי קטגוריות',
    maxGamesMessage: (count) => `אי אפשר להוסיף יותר מ-${count} משחקים למחזור.`,
  },
  [LEAGUE_TYPES.friendly]: {
    liveTitle: 'ניהול יום משחקים',
    empty: 'אין יום משחקים זמין. ניתן ליצור יום חדש.',
    create: 'צור יום משחקים',
    createAnother: 'יום משחקים חדש',
    selectLabel: 'יום משחקים',
    scheduleLabel: 'משחקים ביום',
    statsTitle: 'סטטיסטיקת ידידות',
    maxGamesMessage: (count) => `אי אפשר להוסיף יותר מ-${count} משחקים ביום משחקים.`,
  },
}

const colorLabel = {
  black: 'שחור',
  yellow: 'צהוב',
  pink: 'ורוד',
  orange: 'כתום',
  blue: 'כחול',
  gray: 'אפור',
  white: 'לבן',
}

const getSessionNameFromTeams = (teams = []) =>
  teams.find((team) => typeof team?.sessionName === 'string' && team.sessionName.trim())?.sessionName?.trim() ?? ''

const numberFormatter = new Intl.NumberFormat('en', { style: 'decimal' })

export const getLeagueTypeLabel = (type) => typeLabels[type] ?? type

export const getLeagueModeLabels = (type) => modeLabels[type] ?? modeLabels[LEAGUE_TYPES.tournament]

export const getSessionLabel = (league) => getLeagueModeLabels(league?.type).selectLabel

export const getSessionCustomName = (session) => session?.name?.trim() || getSessionNameFromTeams(session?.teams)

export const getSessionDisplayName = (session, league) => {
  const customName = getSessionCustomName(session)
  if (customName) return customName
  return `${getSessionLabel(league)} ${session?.leagueNumber ?? '-'}`
}

export const applySessionCustomNameToTeams = (teams = [], name) =>
  teams.map((team) => {
    if (!team) return team
    if (name?.trim()) return { ...team, sessionName: name.trim() }
    const rest = { ...team }
    delete rest.sessionName
    return rest
  })

export const getTeamColorLabel = (color) => colorLabel[color] ?? color ?? ''

export const getTeamDisplayName = (team) => team?.name?.trim() || colorLabel[team?.color] || team?.id || '-'

export const getSessionGamesLimit = (league) => {
  if (league?.type === LEAGUE_TYPES.regular) {
    return Math.max(1, Math.floor((league.teams?.length ?? 0) / 2))
  }
  return APP_CONFIG.tournament.gamesPerSession
}

export const getMaxPlayersPerTeam = (league) => {
  if (league?.type === LEAGUE_TYPES.regular) return APP_CONFIG.regular.maxPlayersPerTeam
  if (league?.type === LEAGUE_TYPES.friendly) return APP_CONFIG.friendly.maxPlayersPerTeam
  return APP_CONFIG.tournament.maxPlayersPerTeam
}

export const canEditTeamsInLiveMode = (league) =>
  league?.type !== LEAGUE_TYPES.regular || league?.allowRosterEdits === true

export const createDefaultLeagueName = (type, existingLeagues) => {
  const sameTypeCount = existingLeagues.filter((league) => league.type === type).length + 1
  const prefix =
    type === LEAGUE_TYPES.regular
      ? 'sz league'
      : type === LEAGUE_TYPES.friendly
        ? 'sz friendlies league'
        : 'sz new tournament league'

  const ordinalSuffix =
    sameTypeCount % 10 === 1 && sameTypeCount % 100 !== 11
      ? 'st'
      : sameTypeCount % 10 === 2 && sameTypeCount % 100 !== 12
        ? 'nd'
        : sameTypeCount % 10 === 3 && sameTypeCount % 100 !== 13
          ? 'rd'
          : 'th'

  return `${numberFormatter.format(sameTypeCount)}${ordinalSuffix} ${prefix}`
}
