import { APP_CONFIG } from '../config'
import { defaultPlayers, defaultTournaments } from './defaultData'
import { loadDatasetFromSupabase, resetSupabaseDataset, savePlayersToSupabase, saveTournamentsToSupabase } from './supabaseRest'
import {
  AVAILABLE_DATASETS,
  canResetDataset,
  DEFAULT_DATASET,
  isSupabaseConfigured,
  resolveDataset,
} from './storageConfig'

const ACTIVE_DATASET_KEY = 'soccer-zone-active-dataset'
const ACTIVE_LEAGUE_KEY = 'soccer-zone-active-league'
const LEGACY_PLAYERS_KEY = 'soccer-zone-players'
const LEGACY_TOURNAMENTS_KEY = 'soccer-zone-tournaments'

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const mergePlayers = (storedPlayers) => {
  const map = new Map(defaultPlayers.map((player) => [player.id, player]))
  storedPlayers.forEach((player) => map.set(player.id, player))
  return [...map.values()]
}

const mergeTournaments = (storedTournaments) => {
  const map = new Map(defaultTournaments.map((tournament) => [tournament.id, tournament]))
  storedTournaments.forEach((tournament) => map.set(tournament.id, tournament))
  return [...map.values()].sort((a, b) => {
    if (a.leagueId !== b.leagueId) return a.leagueId.localeCompare(b.leagueId)
    return (a.date ?? '').localeCompare(b.date ?? '')
  })
}

const getStorageKeys = (dataset) => ({
  playersKey: `soccer-zone-${dataset}-players`,
  tournamentsKey: `soccer-zone-${dataset}-tournaments`,
})

const DEFAULT_LEAGUE_ID = APP_CONFIG.leagues[0].id

const migratePlayer = (player) => ({
  ...player,
  leagueId: player.leagueId ?? DEFAULT_LEAGUE_ID,
})

const migrateTournament = (tournament, index) => ({
  ...tournament,
  leagueNumber: tournament.leagueNumber ?? index + 1,
  leagueId: tournament.leagueId ?? DEFAULT_LEAGUE_ID,
  year: tournament.year ?? (Number((tournament.date ?? '').slice(0, 4)) || new Date().getFullYear()),
  teams: (tournament.teams ?? []).map((team, teamIndex) => ({
    ...team,
    color: team.color === 'red' ? 'black' : team.color === 'green' ? 'pink' : team.color,
    id: team.id ?? `team${teamIndex + 1}`,
  })),
  games: (tournament.games ?? []).map((game, gameIndex) => ({
    ...game,
    round: game.round ?? gameIndex + 1,
  })),
})

const defaultDataByDataset = (dataset) => {
  if (dataset === 'prod') return { players: [], tournaments: [] }
  return { players: defaultPlayers, tournaments: defaultTournaments }
}

export const getActiveDataset = () => {
  const dataset = localStorage.getItem(ACTIVE_DATASET_KEY)
  return AVAILABLE_DATASETS.includes(dataset) ? dataset : DEFAULT_DATASET
}

export const setActiveDataset = (dataset) => {
  localStorage.setItem(ACTIVE_DATASET_KEY, resolveDataset(dataset))
}

export const getActiveLeague = () => {
  const leagueId = localStorage.getItem(ACTIVE_LEAGUE_KEY)
  return APP_CONFIG.leagues.some((league) => league.id === leagueId) ? leagueId : DEFAULT_LEAGUE_ID
}

export const setActiveLeague = (leagueId) => {
  localStorage.setItem(ACTIVE_LEAGUE_KEY, leagueId)
}

const normalizeLoadedData = (dataset, data) => ({
  players: data.players.map(migratePlayer),
  tournaments: data.tournaments.map(migrateTournament),
})

const loadDatasetDataFromLocal = (dataset) => {
  const defaults = defaultDataByDataset(dataset)
  const resolvedDataset = resolveDataset(dataset)
  const { playersKey, tournamentsKey } = getStorageKeys(resolvedDataset)
  const storedPlayers = localStorage.getItem(playersKey)
  const storedTournaments = localStorage.getItem(tournamentsKey)

  const legacyPlayers = localStorage.getItem(LEGACY_PLAYERS_KEY)
  const legacyTournaments = localStorage.getItem(LEGACY_TOURNAMENTS_KEY)

  const playersSource = storedPlayers ?? legacyPlayers
  const tournamentsSource = storedTournaments ?? legacyTournaments

  const parsedPlayers = playersSource ? safeParse(playersSource, defaults.players) : defaults.players
  const parsedTournaments = storedTournaments
    ? safeParse(storedTournaments, defaults.tournaments)
    : tournamentsSource
      ? safeParse(tournamentsSource, defaults.tournaments)
      : defaults.tournaments

  return normalizeLoadedData(resolvedDataset, {
    players: resolvedDataset === 'prod' ? parsedPlayers : mergePlayers(parsedPlayers),
    tournaments: resolvedDataset === 'prod' ? parsedTournaments : mergeTournaments(parsedTournaments),
  })
}

export const loadDatasetData = async (dataset) => {
  const resolvedDataset = resolveDataset(dataset)
  if (isSupabaseConfigured()) {
    const data = await loadDatasetFromSupabase(resolvedDataset)
    return normalizeLoadedData(resolvedDataset, data)
  }

  return loadDatasetDataFromLocal(resolvedDataset)
}

const savePlayersToLocal = (dataset, players) => {
  const { playersKey } = getStorageKeys(resolveDataset(dataset))
  localStorage.setItem(playersKey, JSON.stringify(players))
}

const saveTournamentsToLocal = (dataset, tournaments) => {
  const { tournamentsKey } = getStorageKeys(resolveDataset(dataset))
  localStorage.setItem(tournamentsKey, JSON.stringify(tournaments))
}

export const savePlayers = async (dataset, players) => {
  const resolvedDataset = resolveDataset(dataset)
  if (isSupabaseConfigured()) {
    await savePlayersToSupabase(resolvedDataset, players)
    return
  }

  savePlayersToLocal(resolvedDataset, players)
}

export const saveTournaments = async (dataset, tournaments) => {
  const resolvedDataset = resolveDataset(dataset)
  if (isSupabaseConfigured()) {
    await saveTournamentsToSupabase(resolvedDataset, tournaments)
    return
  }

  saveTournamentsToLocal(resolvedDataset, tournaments)
}

export const isResetAllowed = (dataset) => canResetDataset(resolveDataset(dataset))

export const resetDatasetData = async (dataset) => {
  const resolvedDataset = resolveDataset(dataset)
  if (!isResetAllowed(resolvedDataset)) {
    throw new Error(`Reset is disabled for dataset "${resolvedDataset}"`)
  }

  if (isSupabaseConfigured()) {
    await resetSupabaseDataset(resolvedDataset)
    return
  }

  const defaults = defaultDataByDataset(resolvedDataset)
  savePlayersToLocal(resolvedDataset, defaults.players)
  saveTournamentsToLocal(resolvedDataset, defaults.tournaments)
}
