import { getSchemaForDataset, SUPABASE_ANON_KEY, SUPABASE_TIMEOUT_MS, SUPABASE_URL } from './storageConfig'

const PLAYERS_TABLE = 'players'
const TOURNAMENTS_TABLE = 'tournaments'
const MATCHES_TABLE = 'matches'
const isMissingTableError = (error, tableName) =>
  error instanceof Error && error.message.includes(`Could not find the table`) && error.message.includes(tableName)

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

const toMatchRows = (tournaments) =>
  tournaments.flatMap((tournament) =>
    (tournament.games ?? []).map((game) => ({
      id: game.id,
      tournament_id: tournament.id,
      league_id: tournament.leagueId,
      round: game.round ?? 1,
      team_a: game.teamA,
      team_b: game.teamB,
      score: game.score,
      events: game.events ?? [],
    })),
  )

const fromMatchRow = (row) => ({
  id: row.id,
  round: row.round ?? 1,
  teamA: row.team_a,
  teamB: row.team_b,
  score: row.score ?? { a: 0, b: 0 },
  events: Array.isArray(row.events) ? row.events : [],
})

const withMatchesAttached = (tournaments, matchRows) => {
  const matchesByTournamentId = new Map()

  for (const row of matchRows ?? []) {
    const tournamentId = row.tournament_id
    if (!tournamentId) continue
    const nextMatches = matchesByTournamentId.get(tournamentId) ?? []
    nextMatches.push(fromMatchRow(row))
    matchesByTournamentId.set(tournamentId, nextMatches)
  }

  return tournaments.map((tournament) => ({
    ...tournament,
    games: (matchesByTournamentId.get(tournament.id) ?? []).sort(
      (a, b) => (a.round ?? 0) - (b.round ?? 0) || a.id.localeCompare(b.id),
    ),
  }))
}

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
  const playerPromise = request(dataset, `${PLAYERS_TABLE}?select=id,name,league_id&order=name.asc`)

  try {
    const [playerRows, tournamentRows, matchRows] = await Promise.all([
      playerPromise,
      request(
        dataset,
        `${TOURNAMENTS_TABLE}?select=id,date,league_number,league_id,year,teams&order=league_id.asc,date.asc`,
      ),
      request(
        dataset,
        `${MATCHES_TABLE}?select=id,tournament_id,league_id,round,team_a,team_b,score,events&order=tournament_id.asc,round.asc,id.asc`,
      ),
    ])

    const tournaments = withMatchesAttached((tournamentRows ?? []).map(fromTournamentRow), matchRows ?? [])

    return {
      players: (playerRows ?? []).map(fromPlayerRow),
      tournaments,
    }
  } catch (error) {
    if (!isMissingTableError(error, MATCHES_TABLE)) throw error

    const [playerRows, tournamentRows] = await Promise.all([
      playerPromise,
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
}

export const savePlayersToSupabase = async (dataset, players) => {
  await request(dataset, PLAYERS_TABLE, {
    method: 'POST',
    body: JSON.stringify(players.map(toPlayerRow)),
  })
}

export const saveTournamentsToSupabase = async (dataset, tournaments) => {
  const tournamentRows = tournaments.map(toTournamentRow)
  const matchRows = toMatchRows(tournaments)

  try {
    await request(dataset, `${MATCHES_TABLE}?id=not.is.null`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    })
    await request(dataset, `${TOURNAMENTS_TABLE}?id=not.is.null`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    })

    if (tournamentRows.length > 0) {
      await request(dataset, TOURNAMENTS_TABLE, {
        method: 'POST',
        body: JSON.stringify(tournamentRows),
      })
    }

    if (matchRows.length > 0) {
      await request(dataset, MATCHES_TABLE, {
        method: 'POST',
        body: JSON.stringify(matchRows),
      })
    }
    return
  } catch (error) {
    if (!isMissingTableError(error, MATCHES_TABLE)) throw error
  }

  await request(dataset, `${TOURNAMENTS_TABLE}?id=not.is.null`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
  if (tournaments.length > 0) {
    await request(dataset, TOURNAMENTS_TABLE, {
      method: 'POST',
      body: JSON.stringify(
        tournaments.map((tournament) => ({
          ...toTournamentRow(tournament),
          games: tournament.games ?? [],
        })),
      ),
    })
  }
}

export const resetSupabaseDataset = async (dataset) => {
  try {
    await Promise.all([
      request(dataset, `${MATCHES_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      request(dataset, `${TOURNAMENTS_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      request(dataset, `${PLAYERS_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    ])
  } catch (error) {
    if (!isMissingTableError(error, MATCHES_TABLE)) throw error
    await Promise.all([
      request(dataset, `${TOURNAMENTS_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      request(dataset, `${PLAYERS_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    ])
  }
}
