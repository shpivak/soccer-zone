import { getSchemaForDataset, SUPABASE_ANON_KEY, SUPABASE_TIMEOUT_MS, SUPABASE_URL } from './storageConfig'

const PLAYERS_TABLE = 'players'
const TOURNAMENTS_TABLE = 'tournaments'

const toPlayerRow = (player) => ({
  id: player.id,
  name: player.name,
  league_id: player.leagueId,
})

const fromPlayerRow = (row) => ({
  id: row.id,
  name: row.name,
  leagueId: row.league_id,
})

const toTournamentRow = (tournament) => ({
  id: tournament.id,
  date: tournament.date,
  league_number: tournament.leagueNumber,
  league_id: tournament.leagueId,
  year: tournament.year,
  teams: tournament.teams,
  games: tournament.games,
})

const fromTournamentRow = (row) => ({
  id: row.id,
  date: row.date,
  leagueNumber: row.league_number,
  leagueId: row.league_id,
  year: row.year,
  teams: Array.isArray(row.teams) ? row.teams : [],
  games: Array.isArray(row.games) ? row.games : [],
})

const buildHeaders = (dataset, method) => {
  const schema = getSchemaForDataset(dataset)
  const profileHeader = method === 'GET' || method === 'HEAD' ? 'Accept-Profile' : 'Content-Profile'

  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation,resolution=merge-duplicates',
    [profileHeader]: schema,
  }
}

const request = async (dataset, path, init = {}) => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS)

  try {
    const method = init.method ?? 'GET'
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      method,
      headers: {
        ...buildHeaders(dataset, method),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Supabase request failed (${response.status}): ${body || response.statusText}`)
    }

    if (response.status === 204) return null
    const text = await response.text()
    return text ? JSON.parse(text) : null
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export const loadDatasetFromSupabase = async (dataset) => {
  const [playerRows, tournamentRows] = await Promise.all([
    request(dataset, `${PLAYERS_TABLE}?select=id,name,league_id&order=name.asc`),
    request(
      dataset,
      `${TOURNAMENTS_TABLE}?select=id,date,league_number,league_id,year,teams,games&order=league_id.asc,date.asc`,
    ),
  ])

  return {
    players: (playerRows ?? []).map(fromPlayerRow),
    tournaments: (tournamentRows ?? []).map(fromTournamentRow),
  }
}

export const savePlayersToSupabase = async (dataset, players) => {
  await request(dataset, PLAYERS_TABLE, {
    method: 'POST',
    body: JSON.stringify(players.map(toPlayerRow)),
  })
}

export const saveTournamentsToSupabase = async (dataset, tournaments) => {
  await request(dataset, TOURNAMENTS_TABLE, {
    method: 'POST',
    body: JSON.stringify(tournaments.map(toTournamentRow)),
  })
}

export const resetSupabaseDataset = async (dataset) => {
  await Promise.all([
    request(dataset, `${TOURNAMENTS_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    request(dataset, `${PLAYERS_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
  ])
}
