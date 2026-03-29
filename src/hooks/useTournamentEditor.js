import { useMemo, useState } from 'react'
import { APP_CONFIG } from '../config'
import { LEAGUE_TYPES } from '../utils/leagueUtils'

const splitToDefaultTeams = (playerIds) => [
  playerIds.slice(0, 6),
  playerIds.slice(6, 12),
  playerIds.slice(12, 18),
]

const createSessionTeams = (league, players) => {
  if (league?.type === LEAGUE_TYPES.regular) {
    return (league.teams ?? []).map((team) => ({
      ...team,
      players: Array.isArray(team.players) ? [...team.players] : [],
    }))
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
  const leagueNumber = sessions.length + 1
  return {
    id,
    date,
    leagueNumber,
    leagueId: league.id,
    year,
    teams: createSessionTeams(league, players),
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
