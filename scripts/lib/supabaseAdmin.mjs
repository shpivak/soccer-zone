const DEFAULT_SCHEMAS = {
  test: process.env.SUPABASE_TEST_SCHEMA || 'soccer_zone_test',
  prod: process.env.SUPABASE_PROD_SCHEMA || 'soccer_zone_prod',
}

const requireEnv = (name) => {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const getDataset = (input = process.env.SUPABASE_TARGET_DATASET || 'test') => {
  if (input !== 'test' && input !== 'prod') {
    throw new Error(`Unsupported dataset "${input}". Use "test" or "prod".`)
  }
  return input
}

const assertDatasetAllowed = (dataset, actionLabel) => {
  if (dataset !== 'prod') return
  if (process.env.ALLOW_PROD_DB_RESET === 'true') return
  throw new Error(`${actionLabel} against prod is blocked. Set ALLOW_PROD_DB_RESET=true to override.`)
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

const toPlayerRow = (player) => ({
  id: player.id,
  name: player.name,
  league_id: player.leagueId,
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

export const resetDataset = async (datasetInput, { allowProd = false } = {}) => {
  const dataset = getDataset(datasetInput)
  if (!allowProd) {
    assertDatasetAllowed(dataset, 'Reset')
  }

  await Promise.all([
    request(dataset, 'tournaments?id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    request(dataset, 'players?id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
  ])
}

export const seedDataset = async (datasetInput, players, tournaments, { allowProd = false } = {}) => {
  const dataset = getDataset(datasetInput)
  if (!allowProd) {
    assertDatasetAllowed(dataset, 'Seed')
  }

  if (players.length > 0) {
    await request(dataset, 'players', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(players.map(toPlayerRow)),
    })
  }

  if (tournaments.length > 0) {
    await request(dataset, 'tournaments', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(tournaments.map(toTournamentRow)),
    })
  }
}

export const loadDataset = async (datasetInput) => {
  const dataset = getDataset(datasetInput)

  const [players, tournaments] = await Promise.all([
    request(dataset, 'players?select=id,name,league_id&order=name.asc'),
    request(dataset, 'tournaments?select=id,date,league_number,league_id,year,teams,games&order=league_id.asc,date.asc'),
  ])

  return {
    players: players ?? [],
    tournaments: tournaments ?? [],
  }
}
