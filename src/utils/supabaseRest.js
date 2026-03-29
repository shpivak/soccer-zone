import { defaultLeagues } from './defaultData'
import { getSchemaForDataset, SUPABASE_ANON_KEY, SUPABASE_TIMEOUT_MS, SUPABASE_URL } from './storageConfig'

const LEAGUES_TABLE = 'leagues'
const PLAYERS_TABLE = 'players'
const TOURNAMENTS_TABLE = 'tournaments'
const MATCHES_TABLE = 'matches'
const isMissingPlayerRoleColumnsError = (error) =>
  error instanceof Error &&
  ((error.message.includes('is_offense') && error.message.includes('column')) ||
    (error.message.includes('is_defense') && error.message.includes('column')))

const isMissingTableError = (error, tableName) =>
  error instanceof Error && error.message.includes(`Could not find the table`) && error.message.includes(tableName)

const toLeagueRow = (league) => ({
  id: league.id,
  name: league.name,
  type: league.type,
  season_label: league.seasonLabel ?? '',
  allow_roster_edits: league.allowRosterEdits === true,
  teams: league.teams ?? [],
})

const fromLeagueRow = (row) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  seasonLabel: row.season_label ?? '',
  allowRosterEdits: row.allow_roster_edits === true,
  teams: Array.isArray(row.teams) ? row.teams : [],
})

const toPlayerRow = (player) => ({
  id: player.id,
  name: player.name,
  league_id: player.leagueId,
  is_offense: player.isOffense === true,
  is_defense: player.isDefense === true,
})

const fromPlayerRow = (row) => ({
  id: row.id,
  name: row.name,
  leagueId: row.league_id,
  isOffense: row.is_offense ?? null,
  isDefense: row.is_defense ?? null,
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

const isWriteMethod = (method) => method !== 'GET' && method !== 'HEAD'

const buildIdInFilter = (ids) => `id=in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`

const listTableIds = async (dataset, tableName) => {
  const rows = await request(dataset, `${tableName}?select=id`)
  return new Set((rows ?? []).map((row) => row.id))
}

const deleteRemovedRows = async (dataset, tableName, nextIds) => {
  const existingIds = await listTableIds(dataset, tableName)
  const idsToDelete = [...existingIds].filter((id) => !nextIds.has(id))

  if (idsToDelete.length === 0) return

  await request(dataset, `${tableName}?${buildIdInFilter(idsToDelete)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
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
      keepalive: init.keepalive ?? isWriteMethod(method),
      headers: {
        ...buildHeaders(dataset, method),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      const schema = getSchemaForDataset(dataset)
      if (response.status === 406 && body.includes('"code":"PGRST106"') && body.includes('Invalid schema')) {
        throw new Error(
          `Supabase request failed (${response.status}): Invalid schema "${schema}". ` +
            `Expose it in Supabase API settings (PostgREST "exposed schemas"), then reload.`,
        )
      }
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
  const playerPromise = request(dataset, `${PLAYERS_TABLE}?select=id,name,league_id,is_offense,is_defense&order=name.asc`).catch(
    async (error) => {
      if (!isMissingPlayerRoleColumnsError(error)) throw error
      return request(dataset, `${PLAYERS_TABLE}?select=id,name,league_id&order=name.asc`)
    },
  )
  const leaguesPromise = request(
    dataset,
    `${LEAGUES_TABLE}?select=id,name,type,season_label,allow_roster_edits,teams&order=name.asc`,
  ).catch(
    (error) => {
      if (!isMissingTableError(error, LEAGUES_TABLE)) throw error
      return defaultLeagues
    },
  )

  try {
    const [leaguesRows, playerRows, tournamentRows, matchRows] = await Promise.all([
      leaguesPromise,
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

    return {
      leagues: (leaguesRows ?? []).map(fromLeagueRow),
      players: (playerRows ?? []).map(fromPlayerRow),
      tournaments: withMatchesAttached((tournamentRows ?? []).map(fromTournamentRow), matchRows ?? []),
    }
  } catch (error) {
    if (!isMissingTableError(error, MATCHES_TABLE)) throw error

    const [leaguesRows, playerRows, tournamentRows] = await Promise.all([
      leaguesPromise,
      playerPromise,
      request(
        dataset,
        `${TOURNAMENTS_TABLE}?select=id,date,league_number,league_id,year,teams,games&order=league_id.asc,date.asc`,
      ),
    ])

    return {
      leagues: (leaguesRows ?? []).map(fromLeagueRow),
      players: (playerRows ?? []).map(fromPlayerRow),
      tournaments: (tournamentRows ?? []).map(fromTournamentRow),
    }
  }
}

export const saveLeaguesToSupabase = async (dataset, leagues) => {
  try {
    if (leagues.length > 0) {
      await request(dataset, LEAGUES_TABLE, {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(leagues.map(toLeagueRow)),
      })
    }
    await deleteRemovedRows(dataset, LEAGUES_TABLE, new Set(leagues.map((league) => league.id)))
  } catch (error) {
    if (!isMissingTableError(error, LEAGUES_TABLE)) throw error
  }
}

export const savePlayersToSupabase = async (dataset, players) => {
  try {
    if (players.length > 0) {
      await request(dataset, PLAYERS_TABLE, {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(players.map(toPlayerRow)),
      })
    }
  } catch (error) {
    if (!isMissingPlayerRoleColumnsError(error)) throw error
    if (players.length > 0) {
      await request(dataset, PLAYERS_TABLE, {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(
          players.map((player) => ({
            id: player.id,
            name: player.name,
            league_id: player.leagueId,
          })),
        ),
      })
    }
  }

  await deleteRemovedRows(dataset, PLAYERS_TABLE, new Set(players.map((player) => player.id)))
}

export const saveTournamentsToSupabase = async (dataset, tournaments) => {
  const tournamentRows = tournaments.map(toTournamentRow)
  const matchRows = toMatchRows(tournaments)

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

    await Promise.all([
      deleteRemovedRows(dataset, TOURNAMENTS_TABLE, new Set(tournaments.map((tournament) => tournament.id))),
      deleteRemovedRows(dataset, MATCHES_TABLE, new Set(matchRows.map((match) => match.id))),
    ])
    return
  } catch (error) {
    if (!isMissingTableError(error, MATCHES_TABLE)) throw error
  }

  if (tournaments.length > 0) {
    await request(dataset, TOURNAMENTS_TABLE, {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(
        tournaments.map((tournament) => ({
          ...toTournamentRow(tournament),
          games: tournament.games ?? [],
        })),
      ),
    })
  }
  await deleteRemovedRows(dataset, TOURNAMENTS_TABLE, new Set(tournaments.map((tournament) => tournament.id)))
}

export const resetSupabaseDataset = async (dataset) => {
  try {
    await Promise.all([
      request(dataset, `${MATCHES_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      request(dataset, `${TOURNAMENTS_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      request(dataset, `${PLAYERS_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      request(dataset, `${LEAGUES_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    ])
  } catch (error) {
    if (!isMissingTableError(error, MATCHES_TABLE) && !isMissingTableError(error, LEAGUES_TABLE)) throw error
    await Promise.all([
      request(dataset, `${TOURNAMENTS_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
      request(dataset, `${PLAYERS_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    ])
    try {
      await request(dataset, `${LEAGUES_TABLE}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    } catch (leagueError) {
      if (!isMissingTableError(leagueError, LEAGUES_TABLE)) throw leagueError
    }
  }
}
