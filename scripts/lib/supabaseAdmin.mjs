const DEFAULT_SCHEMAS = {
  dev: process.env.SUPABASE_DEV_SCHEMA || 'soccer_zone_dev',
  test: process.env.SUPABASE_TEST_SCHEMA || 'soccer_zone_test',
  prod: process.env.SUPABASE_PROD_SCHEMA || 'soccer_zone_prod',
}
const LEAGUES_TABLE = 'leagues'
const TOURNAMENTS_TABLE = 'tournaments'
const MATCHES_TABLE = 'matches'
const isMissingPlayerRoleColumnsError = (error) =>
  error instanceof Error &&
  ((error.message.includes('is_offense') && error.message.includes('column')) ||
    (error.message.includes('is_defense') && error.message.includes('column')))

const isMissingTableError = (error, tableName) =>
  error instanceof Error && error.message.includes(`Could not find the table`) && error.message.includes(tableName)

const requireEnv = (name) => {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const getDataset = (input = process.env.SUPABASE_TARGET_DATASET || 'dev') => {
  if (input !== 'dev' && input !== 'test' && input !== 'prod') {
    throw new Error(`Unsupported dataset "${input}". Use "dev", "test", or "prod".`)
  }
  return input
}

const assertDatasetAllowed = (dataset, actionLabel) => {
  if (dataset === 'prod') {
    if (process.env.ALLOW_PROD_DB_RESET === 'true') return
    throw new Error(`${actionLabel} against prod is blocked. Set ALLOW_PROD_DB_RESET=true to override.`)
  }
  if (dataset === 'dev') {
    if (process.env.ALLOW_DEV_DB_RESET === 'true') return
    throw new Error(`${actionLabel} against dev is blocked. Set ALLOW_DEV_DB_RESET=true to override.`)
  }
}

const getHeaders = (dataset, method) => {
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const profileHeader = method === 'GET' || method === 'HEAD' ? 'Accept-Profile' : 'Content-Profile'

  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    [profileHeader]: DEFAULT_SCHEMAS[dataset],
  }
}

const request = async (dataset, path, init = {}) => {
  const url = `${requireEnv('SUPABASE_URL')}/rest/v1/${path}`
  const method = init.method ?? 'GET'
  const response = await fetch(url, {
    ...init,
    method,
    headers: {
      ...getHeaders(dataset, method),
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Supabase admin request failed (${response.status}): ${body || response.statusText}`)
  }

  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

const toLeagueRow = (league) => ({
  id: league.id,
  name: league.name,
  type: league.type,
  season_label: league.seasonLabel ?? '',
  allow_roster_edits: league.allowRosterEdits === true,
  teams: league.teams ?? [],
})

const toPlayerRow = (player) => ({
  id: player.id,
  name: player.name,
  league_id: player.leagueId,
  is_offense: player.isOffense === true,
  is_defense: player.isDefense === true,
})

const toTournamentRow = (tournament) => ({
  id: tournament.id,
  date: tournament.date,
  league_number: tournament.leagueNumber,
  league_id: tournament.leagueId,
  year: tournament.year,
  teams: tournament.teams,
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

const dedupeById = (items) => {
  const map = new Map()
  for (const item of items ?? []) {
    if (!item?.id) continue
    map.set(item.id, item)
  }
  return [...map.values()]
}

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

export const resetDataset = async (datasetInput, { allowProd = false } = {}) => {
  const dataset = getDataset(datasetInput)
  if (!allowProd) {
    assertDatasetAllowed(dataset, 'Reset')
  }

  try {
    // Avoid occasional Postgres deadlocks by deleting in a consistent order.
    await request(dataset, `${MATCHES_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    await request(dataset, `${TOURNAMENTS_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    await request(dataset, 'players?id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    await request(dataset, `${LEAGUES_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  } catch (error) {
    if (!isMissingTableError(error, MATCHES_TABLE) && !isMissingTableError(error, LEAGUES_TABLE)) throw error
    await request(dataset, `${TOURNAMENTS_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    await request(dataset, 'players?id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    try {
      await request(dataset, `${LEAGUES_TABLE}?id=not.is.null`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      })
    } catch (leagueError) {
      if (!isMissingTableError(leagueError, LEAGUES_TABLE)) throw leagueError
    }
  }
}

export const seedDataset = async (datasetInput, leagues, players, tournaments, { allowProd = false } = {}) => {
  const dataset = getDataset(datasetInput)
  if (!allowProd) {
    assertDatasetAllowed(dataset, 'Seed')
  }

  const uniqueLeagues = dedupeById(leagues)
  const uniquePlayers = dedupeById(players)
  const uniqueTournaments = dedupeById(tournaments)

  if (uniqueLeagues.length > 0) {
    try {
      await request(dataset, LEAGUES_TABLE, {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(uniqueLeagues.map(toLeagueRow)),
      })
    } catch (error) {
      if (!isMissingTableError(error, LEAGUES_TABLE)) throw error
    }
  }

  if (uniquePlayers.length > 0) {
    try {
      await request(dataset, 'players', {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(uniquePlayers.map(toPlayerRow)),
      })
    } catch (error) {
      if (!isMissingPlayerRoleColumnsError(error)) throw error
      await request(dataset, 'players', {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(
          uniquePlayers.map((player) => ({
            id: player.id,
            name: player.name,
            league_id: player.leagueId,
          })),
        ),
      })
    }
  }

  const tournamentRows = uniqueTournaments.map(toTournamentRow)
  const matchRows = dedupeById(toMatchRows(uniqueTournaments))

  try {
    if (tournamentRows.length > 0) {
      await request(dataset, TOURNAMENTS_TABLE, {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(tournamentRows),
      })
    }

    if (matchRows.length > 0) {
      await request(dataset, MATCHES_TABLE, {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(matchRows),
      })
    }
    return
  } catch (error) {
    if (!isMissingTableError(error, MATCHES_TABLE)) throw error
  }

  if (uniqueTournaments.length > 0) {
    await request(dataset, TOURNAMENTS_TABLE, {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(
        uniqueTournaments.map((tournament) => ({
          ...toTournamentRow(tournament),
          games: tournament.games ?? [],
        })),
      ),
    })
  }
}

export const loadDataset = async (datasetInput) => {
  const dataset = getDataset(datasetInput)

  const playersPromise = request(dataset, 'players?select=id,name,league_id,is_offense,is_defense&order=name.asc').catch(
    async (error) => {
      if (!isMissingPlayerRoleColumnsError(error)) throw error
      return request(dataset, 'players?select=id,name,league_id&order=name.asc')
    },
  )
  const leaguesPromise = request(
    dataset,
    'leagues?select=id,name,type,season_label,allow_roster_edits,teams&order=name.asc',
  ).catch((error) => {
    if (!isMissingTableError(error, LEAGUES_TABLE)) throw error
    return []
  })

  try {
    const [leagues, players, tournaments, matches] = await Promise.all([
      leaguesPromise,
      playersPromise,
      request(dataset, 'tournaments?select=id,date,league_number,league_id,year,teams&order=league_id.asc,date.asc'),
      request(
        dataset,
        'matches?select=id,tournament_id,league_id,round,team_a,team_b,score,events&order=tournament_id.asc,round.asc,id.asc',
      ),
    ])

    return {
      leagues: leagues ?? [],
      players: players ?? [],
      tournaments: withMatchesAttached(
        (tournaments ?? []).map((tournament) => ({
          id: tournament.id,
          date: tournament.date,
          leagueNumber: tournament.league_number,
          leagueId: tournament.league_id,
          year: tournament.year,
          teams: Array.isArray(tournament.teams) ? tournament.teams : [],
          games: [],
        })),
        matches ?? [],
      ),
    }
  } catch (error) {
    if (!isMissingTableError(error, MATCHES_TABLE)) throw error

    const [leagues, players, tournaments] = await Promise.all([
      leaguesPromise,
      playersPromise,
      request(dataset, 'tournaments?select=id,date,league_number,league_id,year,teams,games&order=league_id.asc,date.asc'),
    ])

    return {
      leagues: leagues ?? [],
      players: players ?? [],
      tournaments: (tournaments ?? []).map((tournament) => ({
        id: tournament.id,
        date: tournament.date,
        leagueNumber: tournament.league_number,
        leagueId: tournament.league_id,
        year: tournament.year,
        teams: Array.isArray(tournament.teams) ? tournament.teams : [],
        games: Array.isArray(tournament.games) ? tournament.games : [],
      })),
    }
  }
}
