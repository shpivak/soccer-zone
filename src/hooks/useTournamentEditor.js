import { useMemo, useState } from 'react'
import { APP_CONFIG } from '../config'

const splitToDefaultTeams = (playerIds) => [
  playerIds.slice(0, 6),
  playerIds.slice(6, 13),
  playerIds.slice(13, 20),
]

const createEmptyTournament = (id, date, players, leagueNumber, year, leagueId) => {
  const playerIds = players.map((player) => player.id)
  const splitTeams = splitToDefaultTeams(playerIds)
  return {
    id,
    date,
    leagueNumber,
    leagueId,
    year,
    teams: Array.from({ length: APP_CONFIG.teamsCount }, (_, index) => ({
      id: `team${index + 1}`,
      color: APP_CONFIG.teamColors[index] ?? 'gray',
      players: splitTeams[index] ?? [],
    })),
    games: [],
  }
}

export const useTournamentEditor = (tournaments, players, activeLeagueId) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState(tournaments[0]?.id ?? '')
  const hasSelection = tournaments.some((item) => item.id === selectedTournamentId)
  const resolvedTournamentId = hasSelection ? selectedTournamentId : (tournaments[0]?.id ?? '')

  const selectedTournament = useMemo(
    () => tournaments.find((item) => item.id === resolvedTournamentId) ?? null,
    [resolvedTournamentId, tournaments],
  )

  const createTournament = () => {
    const nextId = `${Date.now()}`
    const today = new Date().toISOString().slice(0, 10)
    const year = new Date().getFullYear()
    const leagueNumber = tournaments.length + 1
    return createEmptyTournament(nextId, today, players, leagueNumber, year, activeLeagueId)
  }

  return {
    selectedTournamentId: resolvedTournamentId,
    setSelectedTournamentId,
    selectedTournament,
    createTournament,
  }
}
