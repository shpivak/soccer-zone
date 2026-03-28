import { APP_CONFIG } from '../config'
import { defaultLeagues, defaultPlayers, defaultTournaments } from './defaultData'
import {
  loadDatasetFromSupabase,
  resetSupabaseDataset,
  saveLeaguesToSupabase,
  savePlayersToSupabase,
  saveTournamentsToSupabase,
} from './supabaseRest'
import { LEAGUE_TYPES } from './leagueUtils'
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

const clone = (value) => JSON.parse(JSON.stringify(value))

const mergeById = (defaults, storedItems) => {
  const map = new Map(defaults.map((item) => [item.id, clone(item)]))
  storedItems.forEach((item) => map.set(item.id, item))
  return [...map.values()]
}

const getStorageKeys = (dataset) => ({
  leaguesKey: `soccer-zone-${dataset}-leagues`,
  playersKey: `soccer-zone-${dataset}-players`,
  tournamentsKey: `soccer-zone-${dataset}-tournaments`,
})

const getPendingStorageKeys = (dataset) => ({
  leaguesKey: `soccer-zone-${dataset}-pending-leagues`,
  playersKey: `soccer-zone-${dataset}-pending-players`,
  tournamentsKey: `soccer-zone-${dataset}-pending-tournaments`,
})

const DEFAULT_LEAGUE_ID = defaultLeagues[0].id
const legacyLeagueIdMap = {
  'friday-noon': 'tournament-1',
  'saturday-a': 'tournament-2',
  'saturday-b': 'tournament-3',
}

const normalizeLeagueId = (leagueId) => legacyLeagueIdMap[leagueId] ?? leagueId ?? DEFAULT_LEAGUE_ID

const placeholderPlayerNames = {
  'א א': 'אורי אביטל',
  'ב ב': 'ברק בן עמי',
  'ג ג': 'גיל גבע',
  'ד ד': 'דור דנון',
  'ה ה': 'הראל הלוי',
  'ו ו': 'ויו וינר',
  'ז ז': 'זיו זוהר',
  'ח ח': 'חן חזון',
}

const normalizedTeamNames = {
  'תל אביב': 'נשרים',
  'חיפה': 'זאבים',
  'ירושלים': 'דרקונים',
  'באר שבע': 'אריות',
  Eagles: 'נשרים',
  Wolves: 'זאבים',
  Dragons: 'דרקונים',
  Lions: 'אריות',
}

const normalizePlayerName = (name) => placeholderPlayerNames[name] ?? name
const normalizeTeamName = (name) => normalizedTeamNames[name] ?? name
const normalizePlayerRoles = (player) => {
  if (player.isOffense === true || player.isDefense === true) {
    return {
      isOffense: player.isOffense === true,
      isDefense: player.isDefense === true,
    }
  }

  const numericId = Number(String(player.id).replace(/\D/g, '')) || 0
  return {
    isOffense: numericId % 2 === 0,
    isDefense: numericId % 2 === 1,
  }
}

const migrateLeague = (league) => ({
  id: league.id,
  name:
    (league.id === 'regular-1' && (league.name?.trim() === 'ליגת סוקרזון 4' || league.name?.trim() === '1st sz league')
      ? 'ליגת סוקרזון 5'
      : league.name?.trim()) || APP_CONFIG.defaultLeagueName,
  type: Object.values(LEAGUE_TYPES).includes(league.type) ? league.type : LEAGUE_TYPES.tournament,
  seasonLabel: league.seasonLabel?.trim() || '2026',
  allowRosterEdits: league.allowRosterEdits === true,
  teams: (league.teams ?? []).map((team, index) => ({
    ...team,
    id: team.id ?? `team${index + 1}`,
    name: normalizeTeamName(team.name ?? ''),
    color: team.color ?? APP_CONFIG.allowedTeamColors[index] ?? 'gray',
    players: Array.isArray(team.players) ? team.players : [],
  })),
})

const migratePlayer = (player) => ({
  ...player,
  name: normalizePlayerName(player.name),
  leagueId: normalizeLeagueId(player.leagueId),
  ...normalizePlayerRoles(player),
})

const migrateTournament = (tournament, index) => ({
  ...tournament,
  leagueNumber: tournament.leagueNumber ?? index + 1,
  leagueId: normalizeLeagueId(tournament.leagueId),
  year: tournament.year ?? (Number((tournament.date ?? '').slice(0, 4)) || new Date().getFullYear()),
  teams: (tournament.teams ?? []).map((team, teamIndex) => ({
    ...team,
    color: team.color === 'red' ? 'black' : team.color === 'green' ? 'pink' : team.color,
    id: team.id ?? `team${teamIndex + 1}`,
    name: normalizeTeamName(team.name ?? ''),
    players: Array.isArray(team.players) ? team.players : [],
  })),
  games: (tournament.games ?? []).map((game, gameIndex) => ({
    ...game,
    round: game.round ?? gameIndex + 1,
  })),
})

const defaultDataByDataset = (dataset) => {
  if (dataset === 'prod') return { leagues: [], players: [], tournaments: [] }
  return {
    leagues: defaultLeagues.map(clone),
    players: defaultPlayers.map(clone),
    tournaments: defaultTournaments.map(clone),
  }
}

export const getActiveDataset = () => {
  const dataset = localStorage.getItem(ACTIVE_DATASET_KEY)
  return AVAILABLE_DATASETS.includes(dataset) ? dataset : DEFAULT_DATASET
}

export const setActiveDataset = (dataset) => {
  localStorage.setItem(ACTIVE_DATASET_KEY, resolveDataset(dataset))
}

export const getActiveLeague = () => {
  const leagueId = normalizeLeagueId(localStorage.getItem(ACTIVE_LEAGUE_KEY))
  return defaultLeagues.some((league) => league.id === leagueId) ? leagueId : DEFAULT_LEAGUE_ID
}

export const setActiveLeague = (leagueId) => {
  localStorage.setItem(ACTIVE_LEAGUE_KEY, leagueId)
}

const normalizeLoadedData = (dataset, data) => ({
  leagues: data.leagues.map(migrateLeague),
  players: data.players.map(migratePlayer),
  tournaments: data.tournaments.map(migrateTournament),
})

const loadDatasetDataFromLocal = (dataset) => {
  const defaults = defaultDataByDataset(dataset)
  const resolvedDataset = resolveDataset(dataset)
  const { leaguesKey, playersKey, tournamentsKey } = getStorageKeys(resolvedDataset)
  const storedLeagues = localStorage.getItem(leaguesKey)
  const storedPlayers = localStorage.getItem(playersKey)
  const storedTournaments = localStorage.getItem(tournamentsKey)

  const legacyPlayers = localStorage.getItem(LEGACY_PLAYERS_KEY)
  const legacyTournaments = localStorage.getItem(LEGACY_TOURNAMENTS_KEY)

  const parsedLeagues = storedLeagues ? safeParse(storedLeagues, defaults.leagues) : defaults.leagues
  const parsedPlayers = (storedPlayers ?? legacyPlayers)
    ? safeParse(storedPlayers ?? legacyPlayers, defaults.players)
    : defaults.players
  const parsedTournaments = storedTournaments
    ? safeParse(storedTournaments, defaults.tournaments)
    : legacyTournaments
      ? safeParse(legacyTournaments, defaults.tournaments)
      : defaults.tournaments

  return normalizeLoadedData(resolvedDataset, {
    leagues: resolvedDataset === 'prod' ? parsedLeagues : mergeById(defaults.leagues, parsedLeagues),
    players: resolvedDataset === 'prod' ? parsedPlayers : mergeById(defaults.players, parsedPlayers),
    tournaments:
      resolvedDataset === 'prod'
        ? parsedTournaments
        : mergeById(defaults.tournaments, parsedTournaments).sort((a, b) => {
            if (a.leagueId !== b.leagueId) return a.leagueId.localeCompare(b.leagueId)
            return (a.date ?? '').localeCompare(b.date ?? '')
          }),
  })
}

const loadPendingDatasetData = (dataset) => {
  const resolvedDataset = resolveDataset(dataset)
  const { leaguesKey, playersKey, tournamentsKey } = getPendingStorageKeys(resolvedDataset)

  return {
    leagues: localStorage.getItem(leaguesKey),
    players: localStorage.getItem(playersKey),
    tournaments: localStorage.getItem(tournamentsKey),
  }
}

const savePendingLeagues = (dataset, leagues) => {
  const { leaguesKey } = getPendingStorageKeys(resolveDataset(dataset))
  localStorage.setItem(leaguesKey, JSON.stringify(leagues))
}

const savePendingPlayers = (dataset, players) => {
  const { playersKey } = getPendingStorageKeys(resolveDataset(dataset))
  localStorage.setItem(playersKey, JSON.stringify(players))
}

const savePendingTournaments = (dataset, tournaments) => {
  const { tournamentsKey } = getPendingStorageKeys(resolveDataset(dataset))
  localStorage.setItem(tournamentsKey, JSON.stringify(tournaments))
}

const clearPendingLeagues = (dataset) => {
  const { leaguesKey } = getPendingStorageKeys(resolveDataset(dataset))
  localStorage.removeItem(leaguesKey)
}

const clearPendingPlayers = (dataset) => {
  const { playersKey } = getPendingStorageKeys(resolveDataset(dataset))
  localStorage.removeItem(playersKey)
}

const clearPendingTournaments = (dataset) => {
  const { tournamentsKey } = getPendingStorageKeys(resolveDataset(dataset))
  localStorage.removeItem(tournamentsKey)
}

export const loadDatasetData = async (dataset) => {
  const resolvedDataset = resolveDataset(dataset)
  if (isSupabaseConfigured()) {
    const data = await loadDatasetFromSupabase(resolvedDataset)
    const pending = loadPendingDatasetData(resolvedDataset)

    return normalizeLoadedData(resolvedDataset, {
      leagues: pending.leagues ? safeParse(pending.leagues, data.leagues) : data.leagues,
      players: pending.players ? safeParse(pending.players, data.players) : data.players,
      tournaments: pending.tournaments ? safeParse(pending.tournaments, data.tournaments) : data.tournaments,
    })
  }

  return loadDatasetDataFromLocal(resolvedDataset)
}

const saveLeaguesToLocal = (dataset, leagues) => {
  const { leaguesKey } = getStorageKeys(resolveDataset(dataset))
  localStorage.setItem(leaguesKey, JSON.stringify(leagues))
}

const savePlayersToLocal = (dataset, players) => {
  const { playersKey } = getStorageKeys(resolveDataset(dataset))
  localStorage.setItem(playersKey, JSON.stringify(players))
}

const saveTournamentsToLocal = (dataset, tournaments) => {
  const { tournamentsKey } = getStorageKeys(resolveDataset(dataset))
  localStorage.setItem(tournamentsKey, JSON.stringify(tournaments))
}

export const saveLeagues = async (dataset, leagues) => {
  const resolvedDataset = resolveDataset(dataset)
  if (isSupabaseConfigured()) {
    savePendingLeagues(resolvedDataset, leagues)
    await saveLeaguesToSupabase(resolvedDataset, leagues)
    clearPendingLeagues(resolvedDataset)
    return
  }

  saveLeaguesToLocal(resolvedDataset, leagues)
}

export const savePlayers = async (dataset, players) => {
  const resolvedDataset = resolveDataset(dataset)
  if (isSupabaseConfigured()) {
    savePendingPlayers(resolvedDataset, players)
    await savePlayersToSupabase(resolvedDataset, players)
    clearPendingPlayers(resolvedDataset)
    return
  }

  savePlayersToLocal(resolvedDataset, players)
}

export const saveTournaments = async (dataset, tournaments) => {
  const resolvedDataset = resolveDataset(dataset)
  if (isSupabaseConfigured()) {
    savePendingTournaments(resolvedDataset, tournaments)
    await saveTournamentsToSupabase(resolvedDataset, tournaments)
    clearPendingTournaments(resolvedDataset)
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
    clearPendingLeagues(resolvedDataset)
    clearPendingPlayers(resolvedDataset)
    clearPendingTournaments(resolvedDataset)
    return
  }

  const defaults = defaultDataByDataset(resolvedDataset)
  saveLeaguesToLocal(resolvedDataset, defaults.leagues)
  savePlayersToLocal(resolvedDataset, defaults.players)
  saveTournamentsToLocal(resolvedDataset, defaults.tournaments)
}
