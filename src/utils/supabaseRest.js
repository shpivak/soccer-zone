import { defaultLeagues } from './defaultData'
import { getSchemaForDataset, IS_LITE_MODE, SUPABASE_ANON_KEY, SUPABASE_TIMEOUT_MS, SUPABASE_URL } from './storageConfig'

const LEAGUES_TABLE = 'leagues'
const PLAYERS_TABLE = 'players'
const TOURNAMENTS_TABLE = 'tournaments'
const MATCHES_TABLE = 'matches'
const isMissingPlayerRoleColumnsError = (error) =>
  error instanceof Error &&
  ((error.message.includes('is_offense') && error.message.includes('column')) ||
    (error.message.includes('is_defense') && error.message.includes('column')) ||
    (error.message.includes('player_rank') && error.message.includes('column')) ||
    (error.message.includes('WITHIN GROUP') && error.message.includes('rank')))

// null = unknown, true/false = cached result for the lifetime of the page
let playerRoleColumnsSupported = null
let leagueCoachIdColumnSupported = null

const toPlayerRowBasic = (player) => ({
  id: player.id,
  name: player.name,
  league_id: player.leagueId,
})

const isMissingTableError = (error, tableName) =>
  error instanceof Error && error.message.includes(`Could not find the table`) && error.message.includes(tableName)

const isMissingCoachIdColumnError = (error) =>
  error instanceof Error && error.message.includes('coach_id') && error.message.includes('column')

const toLeagueRow = (league) => ({
  id: league.id,
  name: league.name,
  type: league.type,
  season_label: league.seasonLabel ?? '',
  allow_roster_edits: league.allowRosterEdits === true,
  teams: league.teams ?? [],
  // Lite schemas have admin_password; soccer-zone schemas have coach_id — never both
  ...(IS_LITE_MODE
    ? { admin_password: league.adminPassword ?? '' }
    : leagueCoachIdColumnSupported !== false ? { coach_id: league.coachId ?? null } : {}),
})

const fromLeagueRow = (row) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  seasonLabel: row.season_label ?? '',
  allowRosterEdits: row.allow_roster_edits === true,
  teams: Array.isArray(row.teams) ? row.teams : [],
  ...(IS_LITE_MODE
    ? { adminPassword: row.admin_password ?? '' }
    : row.coach_id ? { coachId: row.coach_id } : {}),
})

const toPlayerRow = (player) => ({
  id: player.id,
  name: player.name,
  league_id: player.leagueId,
  is_offense: player.isOffense === true,
  is_defense: player.isDefense === true,
  player_rank: player.rank ?? 'B',
})

const fromPlayerRow = (row) => ({
  id: row.id,
  name: row.name,
  leagueId: row.league_id,
  isOffense: row.is_offense ?? null,
  isDefense: row.is_defense ?? null,
  rank: row.player_rank ?? 'B',
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

// description and clockSeconds are stored as a hidden _meta entry inside the events JSONB column
// so no extra Supabase columns are required
const MATCH_META_TYPE = '_meta'

const toMatchRows = (tournaments) =>
  tournaments.flatMap((tournament) =>
    (tournament.games ?? []).map((game) => {
      // played===false is stored in the _meta entry so no DB schema change is needed
      const isPlayed = game.played !== false
      const needsMeta = game.description || game.clockSeconds || !isPlayed
      const meta = needsMeta
        ? [{ type: MATCH_META_TYPE, description: game.description ?? null, clockSeconds: game.clockSeconds ?? 0, played: isPlayed }]
        : []
      return {
        id: game.id,
        tournament_id: tournament.id,
        league_id: tournament.leagueId,
        round: game.round ?? 1,
        team_a: game.teamA,
        team_b: game.teamB,
        score: game.score ?? { a: 0, b: 0 },
        events: [...meta, ...(game.events ?? [])],
      }
    }),
  )

const fromMatchRow = (row) => {
  const allEvents = Array.isArray(row.events) ? row.events : []
  const meta = allEvents.find((e) => e.type === MATCH_META_TYPE)
  const events = allEvents.filter((e) => e.type !== MATCH_META_TYPE)
  // played defaults to true for backward compat (existing games without the flag were all played)
  const played = meta ? meta.played !== false : true
  return {
    id: row.id,
    round: row.round ?? 1,
    teamA: row.team_a,
    teamB: row.team_b,
    score: row.score ?? { a: 0, b: 0 },
    played,
    clockSeconds: meta?.clockSeconds ?? 0,
    events,
    ...(meta?.description ? { description: meta.description } : {}),
  }
}

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
      keepalive: init.keepalive ?? false,
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
  const fetchPlayers = async () => {
    if (playerRoleColumnsSupported === false) {
      return request(dataset, `${PLAYERS_TABLE}?select=id,name,league_id&order=name.asc`)
    }
    try {
      const rows = await request(dataset, `${PLAYERS_TABLE}?select=id,name,league_id,is_offense,is_defense,player_rank&order=name.asc`)
      playerRoleColumnsSupported = true
      return rows
    } catch (error) {
      if (!isMissingPlayerRoleColumnsError(error)) throw error
      playerRoleColumnsSupported = false
      return request(dataset, `${PLAYERS_TABLE}?select=id,name,league_id&order=name.asc`)
    }
  }
  const fetchLeagues = async () => {
    // Lite schemas have admin_password instead of coach_id — use a single fixed query
    if (IS_LITE_MODE) {
      return request(
        dataset,
        `${LEAGUES_TABLE}?select=id,name,type,season_label,allow_roster_edits,teams,admin_password&order=name.asc`,
      )
    }

    const fetchWithCoachId = () =>
      request(dataset, `${LEAGUES_TABLE}?select=id,name,type,season_label,allow_roster_edits,teams,coach_id&order=name.asc`)
    const fetchWithoutCoachId = () =>
      request(dataset, `${LEAGUES_TABLE}?select=id,name,type,season_label,allow_roster_edits,teams&order=name.asc`)

    if (leagueCoachIdColumnSupported === false) return fetchWithoutCoachId()

    try {
      const rows = await fetchWithCoachId()
      leagueCoachIdColumnSupported = true
      return rows
    } catch (error) {
      if (isMissingCoachIdColumnError(error)) {
        leagueCoachIdColumnSupported = false
        return fetchWithoutCoachId()
      }
      if (isMissingTableError(error, LEAGUES_TABLE)) return defaultLeagues
      throw error
    }
  }

  // Lite mode: load leagues first so the auth/creation screen appears immediately
  // without waiting for players/tournaments/matches. If leagues fail (e.g. schema
  // not exposed), we abort early rather than firing three more failing requests.
  if (IS_LITE_MODE) {
    const leaguesRows = await fetchLeagues()
    const [playerRows, tournamentRows, matchRows] = await Promise.all([
      fetchPlayers(),
      request(dataset, `${TOURNAMENTS_TABLE}?select=id,date,league_number,league_id,year,teams&order=league_id.asc,date.asc`),
      request(dataset, `${MATCHES_TABLE}?select=id,tournament_id,league_id,round,team_a,team_b,score,events&order=tournament_id.asc,round.asc,id.asc`),
    ])
    return {
      leagues: (leaguesRows ?? []).map(fromLeagueRow),
      players: (playerRows ?? []).map(fromPlayerRow),
      tournaments: withMatchesAttached((tournamentRows ?? []).map(fromTournamentRow), matchRows ?? []),
    }
  }

  const playerPromise = fetchPlayers()
  const leaguesPromise = fetchLeagues()

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

export const saveLeaguesToSupabase = async (dataset, leagues, { keepalive = false } = {}) => {
  const postLeagues = async (rows) => {
    if (rows.length > 0) {
      await request(dataset, LEAGUES_TABLE, {
        method: 'POST',
        keepalive,
        headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(rows),
      })
    }
  }
  try {
    await postLeagues(leagues.map(toLeagueRow))
    await deleteRemovedRows(dataset, LEAGUES_TABLE, new Set(leagues.map((league) => league.id)))
  } catch (error) {
    // Lite mode uses admin_password instead of coach_id — no fallback needed
    if (!IS_LITE_MODE && isMissingCoachIdColumnError(error)) {
      leagueCoachIdColumnSupported = false
      await postLeagues(leagues.map(toLeagueRow)) // retry without coach_id (flag now false)
      await deleteRemovedRows(dataset, LEAGUES_TABLE, new Set(leagues.map((league) => league.id)))
      return
    }
    if (!isMissingTableError(error, LEAGUES_TABLE)) throw error
  }
}

export const savePlayersToSupabase = async (dataset, players, { keepalive = false } = {}) => {
  if (players.length > 0) {
    const postOptions = (rows) => ({
      method: 'POST',
      keepalive,
      headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: JSON.stringify(rows),
    })

    if (playerRoleColumnsSupported === false) {
      await request(dataset, PLAYERS_TABLE, postOptions(players.map(toPlayerRowBasic)))
    } else {
      try {
        await request(dataset, PLAYERS_TABLE, postOptions(players.map(toPlayerRow)))
        playerRoleColumnsSupported = true
      } catch (error) {
        if (!isMissingPlayerRoleColumnsError(error)) throw error
        playerRoleColumnsSupported = false
        await request(dataset, PLAYERS_TABLE, postOptions(players.map(toPlayerRowBasic)))
      }
    }
  }

  await deleteRemovedRows(dataset, PLAYERS_TABLE, new Set(players.map((player) => player.id)))
}

export const saveTournamentsToSupabase = async (dataset, tournaments, { keepalive = false } = {}) => {
  const tournamentRows = tournaments.map(toTournamentRow)
  const matchRows = toMatchRows(tournaments)

  try {
    if (tournamentRows.length > 0) {
      await request(dataset, TOURNAMENTS_TABLE, {
        method: 'POST',
        keepalive,
        headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(tournamentRows),
      })
    }

    if (matchRows.length > 0) {
      await request(dataset, MATCHES_TABLE, {
        method: 'POST',
        keepalive,
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
      keepalive,
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

export const deleteLeagueFromSupabase = async (dataset, leagueId) => {
  const leagueFilter = `league_id=eq.${encodeURIComponent(leagueId)}`
  // Delete dependent rows first (matches → tournaments/players → league)
  try {
    await request(dataset, `${MATCHES_TABLE}?${leagueFilter}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  } catch (error) {
    if (!isMissingTableError(error, MATCHES_TABLE)) throw error
  }
  await request(dataset, `${TOURNAMENTS_TABLE}?${leagueFilter}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  await request(dataset, `${PLAYERS_TABLE}?${leagueFilter}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  try {
    await request(dataset, `${LEAGUES_TABLE}?id=eq.${encodeURIComponent(leagueId)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    })
  } catch (error) {
    if (!isMissingTableError(error, LEAGUES_TABLE)) throw error
  }
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
