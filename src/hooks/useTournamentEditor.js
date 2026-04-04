import { useMemo, useState } from 'react'
import { APP_CONFIG } from '../config'
import { LEAGUE_TYPES } from '../utils/leagueUtils'

const splitToDefaultTeams = (playerIds) => [
  playerIds.slice(0, 6),
  playerIds.slice(6, 12),
  playerIds.slice(12, 18),
]

const cloneTeams = (teams = []) =>
  teams.map((team) => ({
    ...team,
    players: Array.isArray(team.players) ? [...team.players] : [],
  }))

const getRegularLeagueBaseTeams = (league, sessions) => {
  const firstSessionWithTeams = [...(sessions ?? [])]
    .filter((session) => Array.isArray(session.teams) && session.teams.length > 0)
    .sort(
      (a, b) =>
        (a.leagueNumber ?? Number.MAX_SAFE_INTEGER) - (b.leagueNumber ?? Number.MAX_SAFE_INTEGER) ||
        String(a.date ?? '').localeCompare(String(b.date ?? '')) ||
        String(a.id ?? '').localeCompare(String(b.id ?? '')),
    )[0]

  if (firstSessionWithTeams) return cloneTeams(firstSessionWithTeams.teams)
  return cloneTeams(league?.teams ?? [])
}

const createSessionTeams = (league, players, sessions = []) => {
  if (league?.type === LEAGUE_TYPES.regular) {
    return getRegularLeagueBaseTeams(league, sessions)
  }

  const playerIds = players.map((player) => player.id)
  const splitTeams = splitToDefaultTeams(playerIds)
  const teamCount = APP_CONFIG.friendly.teamsCount
  return Array.from({ length: teamCount }, (_, index) => ({
    id: `team${index + 1}`,
    color: APP_CONFIG.teamColors[index] ?? 'gray',
    name: '',
    players: splitTeams[index] ?? [],
  }))
}

const createEmptySession = (id, date, players, league, sessions) => {
  const year = new Date().getFullYear()
  const leagueNumber = sessions.reduce((max, session) => Math.max(max, session.leagueNumber ?? 0), 0) + 1
  return {
    id,
    date,
    leagueNumber,
    leagueId: league.id,
    year,
    teams: createSessionTeams(league, players, sessions),
    games: [],
  }
}

export const useTournamentEditor = (sessions, players, league) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState(sessions[0]?.id ?? '')
  const hasSelection = sessions.some((item) => item.id === selectedTournamentId)
  const resolvedTournamentId = hasSelection ? selectedTournamentId : (sessions[0]?.id ?? '')

  const selectedTournament = useMemo(
    () => sessions.find((item) => item.id === resolvedTournamentId) ?? null,
    [resolvedTournamentId, sessions],
  )

  const createTournament = () => {
    const nextId = `${league.id}-${Date.now()}`
    const today = new Date().toISOString().slice(0, 10)
    return createEmptySession(nextId, today, players, league, sessions)
  }

  return {
    selectedTournamentId: resolvedTournamentId,
    setSelectedTournamentId,
    selectedTournament,
    createTournament,
  }
}
