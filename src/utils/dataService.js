import defaultPlayers from '../../mock_data/players.json'
import tournamentOne from '../../mock_data/tournaments/tournament-1.json'
import tournamentTwo from '../../mock_data/tournaments/tournament-2.json'
import tournamentThree from '../../mock_data/tournaments/tournament-3.json'
import tournamentFour from '../../mock_data/tournaments/tournament-4.json'
import tournamentFive from '../../mock_data/tournaments/tournament-5.json'
import { APP_CONFIG } from '../config'

const ACTIVE_DATASET_KEY = 'soccer-zone-active-dataset'
const ACTIVE_LEAGUE_KEY = 'soccer-zone-active-league'
const LEGACY_PLAYERS_KEY = 'soccer-zone-players'
const LEGACY_TOURNAMENTS_KEY = 'soccer-zone-tournaments'

const defaultTournaments = [tournamentOne, tournamentTwo, tournamentThree, tournamentFour, tournamentFive]
const DATASETS = ['test', 'current', 'prod']

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
  return DATASETS.includes(dataset) ? dataset : 'test'
}

export const setActiveDataset = (dataset) => {
  localStorage.setItem(ACTIVE_DATASET_KEY, dataset)
}

export const getActiveLeague = () => {
  const leagueId = localStorage.getItem(ACTIVE_LEAGUE_KEY)
  return APP_CONFIG.leagues.some((league) => league.id === leagueId) ? leagueId : DEFAULT_LEAGUE_ID
}

export const setActiveLeague = (leagueId) => {
  localStorage.setItem(ACTIVE_LEAGUE_KEY, leagueId)
}

export const loadDatasetData = (dataset) => {
  const defaults = defaultDataByDataset(dataset)
  const { playersKey, tournamentsKey } = getStorageKeys(dataset)
  const storedPlayers = localStorage.getItem(playersKey)
  const storedTournaments = localStorage.getItem(tournamentsKey)

  const legacyPlayers = localStorage.getItem(LEGACY_PLAYERS_KEY)
  const legacyTournaments = localStorage.getItem(LEGACY_TOURNAMENTS_KEY)

  const playersSource = storedPlayers ?? (dataset === 'current' ? legacyPlayers : null)
  const tournamentsSource = storedTournaments ?? (dataset === 'current' ? legacyTournaments : null)

  const parsedPlayers = playersSource ? safeParse(playersSource, defaults.players) : defaults.players
  const parsedTournaments = storedTournaments
    ? safeParse(storedTournaments, defaults.tournaments)
    : tournamentsSource
      ? safeParse(tournamentsSource, defaults.tournaments)
      : defaults.tournaments

  return {
    players: (dataset === 'prod' ? parsedPlayers : mergePlayers(parsedPlayers)).map(migratePlayer),
    tournaments: (dataset === 'prod' ? parsedTournaments : mergeTournaments(parsedTournaments)).map(
      migrateTournament,
    ),
  }
}

export const savePlayers = (dataset, players) => {
  const { playersKey } = getStorageKeys(dataset)
  // FUTURE: replace localStorage with Supabase
  // FUTURE: replace with Supabase:
  // supabase.from('players').upsert(players)
  localStorage.setItem(playersKey, JSON.stringify(players))
}

export const saveTournaments = (dataset, tournaments) => {
  const { tournamentsKey } = getStorageKeys(dataset)
  // FUTURE: replace localStorage with Supabase
  // FUTURE: replace with Supabase:
  // supabase.from('tournaments').upsert(tournaments)
  localStorage.setItem(tournamentsKey, JSON.stringify(tournaments))
}

export const resetDatasetData = (dataset) => {
  const defaults = defaultDataByDataset(dataset)
  savePlayers(dataset, defaults.players)
  saveTournaments(dataset, defaults.tournaments)
}
