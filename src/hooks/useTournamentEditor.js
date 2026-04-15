import { useEffect, useMemo, useState } from 'react'
import { APP_CONFIG } from '../config'
import { LEAGUE_TYPES } from '../utils/leagueUtils'

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

const createSessionTeams = (league, sessions = []) => {
  if (league?.type === LEAGUE_TYPES.regular) {
    return getRegularLeagueBaseTeams(league, sessions)
  }

  const teamCount =
    league?.type === LEAGUE_TYPES.friendly
      ? APP_CONFIG.friendly.teamsCount
      : APP_CONFIG.tournament.teamsCount
  return Array.from({ length: teamCount }, (_, index) => ({
    id: `team${index + 1}`,
    color: APP_CONFIG.teamColors[index] ?? 'gray',
    name: '',
    players: [],
  }))
}

const createEmptySession = (id, date, players, league, sessions) => {
  const year = new Date().getFullYear()
  const leagueNumber = sessions.reduce((max, session) => Math.max(max, session.leagueNumber ?? 0), 0) + 1
  return {
    id,
    name: '',
    date,
    leagueNumber,
    leagueId: league.id,
    year,
    teams: createSessionTeams(league, sessions),
    games: [],
  }
}

const getTournamentIdFromUrl = () => {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('tournament') ?? ''
}

const syncUrlSelection = (leagueId, tournamentId = '') => {
  if (typeof window === 'undefined' || !leagueId) return
  const url = new URL(window.location.href)
  url.searchParams.set('league', leagueId)
  if (tournamentId) {
    url.searchParams.set('tournament', tournamentId)
  } else {
    url.searchParams.delete('tournament')
  }
  window.history.replaceState({}, '', url)
}

export const useTournamentEditor = (sessions, players, league) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => getTournamentIdFromUrl() || sessions[0]?.id || '')
  const tournamentIdFromUrl = getTournamentIdFromUrl()
  const hasSelection = sessions.some((item) => item.id === selectedTournamentId)
  const hasUrlSelection = sessions.some((item) => item.id === tournamentIdFromUrl)
  const resolvedTournamentId = hasSelection
    ? selectedTournamentId
    : hasUrlSelection
      ? tournamentIdFromUrl
      : (sessions[0]?.id ?? '')

  const selectedTournament = useMemo(
    () => sessions.find((item) => item.id === resolvedTournamentId) ?? null,
    [resolvedTournamentId, sessions],
  )

  const createTournament = () => {
    const nextId = `${league.id}-${Date.now()}`
    const today = new Date().toISOString().slice(0, 10)
    return createEmptySession(nextId, today, players, league, sessions)
  }

  useEffect(() => {
    if (!league?.id) return
    syncUrlSelection(league.id, resolvedTournamentId)
  }, [league?.id, resolvedTournamentId])

  return {
    selectedTournamentId: resolvedTournamentId,
    setSelectedTournamentId,
    selectedTournament,
    createTournament,
  }
}
