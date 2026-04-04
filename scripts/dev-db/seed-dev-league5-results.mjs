#!/usr/bin/env node
import '../lib/loadEnv.mjs'

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const SCHEMA = process.env.SUPABASE_DEV_SCHEMA?.trim() || process.env.VITE_SUPABASE_DEV_SCHEMA?.trim() || 'soccer_zone_dev'
const DRY_RUN = process.argv.includes('--dry-run')
const LEAGUE_NAME_FRAGMENT = 'ליגת סוקרזון 5'
const PREFERRED_LEAGUE_NAME = 'ליגת סוקרזון 5 - 2025'
const DEFAULT_YEAR = 2026

const FALLBACK_LEAGUE = {
  id: 'league-1774816188496',
  name: PREFERRED_LEAGUE_NAME,
  type: 'regular',
  season_label: '2026',
  allow_roster_edits: false,
  teams: [
    { id: 'regular-team-1774816243379', name: 'נשרים', color: 'black', players: [] },
    { id: 'regular-team-1774816250225', name: 'אריות', color: 'yellow', players: [] },
    { id: 'regular-team-1774816254176', name: 'דרקונים', color: 'pink', players: [] },
    { id: 'regular-team-1774816258108', name: 'זאבים', color: 'orange', players: [] },
  ],
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
  process.exit(1)
}

const request = async (path, init = {}) => {
  const method = init.method ?? 'GET'
  const profileHeader = method === 'GET' || method === 'HEAD' ? 'Accept-Profile' : 'Content-Profile'
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates',
      [profileHeader]: SCHEMA,
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`)
  }

  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

const slug = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0590-\u05ff-]/g, '')

const normalizeName = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['"`׳״]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\u0590-\u05ff ]/g, '')
    .replace(/\s/g, '')

const buildInFilter = (values) => values.map((value) => encodeURIComponent(value)).join(',')

const buildGoalSequence = (goalTotalsByPlayerId, matchGoalCounts) => {
  const remaining = new Map(Object.entries(goalTotalsByPlayerId))
  const order = Object.entries(goalTotalsByPlayerId)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([playerId]) => playerId)

  return matchGoalCounts.map((goalCount) => {
    const scorers = []
    for (let index = 0; index < goalCount; index += 1) {
      const nextPlayerId = [...order]
        .sort((a, b) => (remaining.get(b) ?? 0) - (remaining.get(a) ?? 0) || a.localeCompare(b))
        .find((playerId) => (remaining.get(playerId) ?? 0) > 0)

      if (!nextPlayerId) throw new Error('Failed to allocate goal scorers')
      scorers.push(nextPlayerId)
      remaining.set(nextPlayerId, (remaining.get(nextPlayerId) ?? 0) - 1)
    }
    return scorers
  })
}

const assignAssists = (eventsByMatch, assistTotalsByPlayerId) => {
  const remainingAssistEntries = Object.entries(assistTotalsByPlayerId).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const availableRefs = []

  eventsByMatch.forEach((events, matchIndex) => {
    events.forEach((event, eventIndex) => {
      availableRefs.push({ matchIndex, eventIndex, scorer: event.scorer })
    })
  })

  for (const [playerId, count] of remainingAssistEntries) {
    for (let index = 0; index < count; index += 1) {
      let refIndex = availableRefs.findIndex((ref) => ref.scorer !== playerId)
      if (refIndex === -1) refIndex = 0
      if (refIndex === -1) throw new Error(`Failed to allocate assist for ${playerId}`)
      const [ref] = availableRefs.splice(refIndex, 1)
      eventsByMatch[ref.matchIndex][ref.eventIndex].assister = playerId
    }
  }
}

const validateDataset = ({ teams, players, tournaments }) => {
  const goalCount = new Map()
  const assistCount = new Map()
  const standings = new Map(
    teams.map((team) => [
      team.id,
      { teamName: team.name, points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
    ]),
  )

  for (const tournament of tournaments) {
    for (const game of tournament.games) {
      const teamAStats = standings.get(game.teamA)
      const teamBStats = standings.get(game.teamB)
      teamAStats.goalsFor += game.score.a
      teamAStats.goalsAgainst += game.score.b
      teamBStats.goalsFor += game.score.b
      teamBStats.goalsAgainst += game.score.a

      if (game.score.a > game.score.b) {
        teamAStats.wins += 1
        teamBStats.losses += 1
        teamAStats.points += 3
      } else if (game.score.b > game.score.a) {
        teamBStats.wins += 1
        teamAStats.losses += 1
        teamBStats.points += 3
      } else {
        teamAStats.draws += 1
        teamBStats.draws += 1
        teamAStats.points += 1
        teamBStats.points += 1
      }

      const goalsForTeamA = game.events.filter((event) => event.teamId === game.teamA).length
      const goalsForTeamB = game.events.filter((event) => event.teamId === game.teamB).length
      if (goalsForTeamA !== game.score.a || goalsForTeamB !== game.score.b) {
        throw new Error(`Event totals do not match score for ${game.id}`)
      }

      for (const event of game.events) {
        if (event.type !== 'goal') continue
        goalCount.set(event.scorer, (goalCount.get(event.scorer) ?? 0) + 1)
        if (event.assister) assistCount.set(event.assister, (assistCount.get(event.assister) ?? 0) + 1)
      }
    }
  }

  return {
    scorers: [...goalCount.entries()].map(([playerId, goals]) => ({
      playerId,
      name: players.find((player) => player.id === playerId)?.name ?? playerId,
      goals,
    })),
    assisters: [...assistCount.entries()].map(([playerId, assists]) => ({
      playerId,
      name: players.find((player) => player.id === playerId)?.name ?? playerId,
      assists,
    })),
    standings: [...standings.values()]
      .map((row) => ({ ...row, goalDiff: row.goalsFor - row.goalsAgainst }))
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.goalDiff - a.goalDiff ||
          b.goalsFor - a.goalsFor ||
          b.wins - a.wins ||
          a.teamName.localeCompare(b.teamName),
      ),
  }
}

const printSummary = (label, summary) => {
  console.log(`\n${label}`)
  console.log('Standings:')
  for (const row of summary.standings) {
    console.log(
      `${row.teamName}: ${row.points} pts | W${row.wins} D${row.draws} L${row.losses} | GF ${row.goalsFor} GA ${row.goalsAgainst} GD ${row.goalDiff}`,
    )
  }

  console.log('\nTop scorers:')
  for (const row of [...summary.scorers].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))) {
    console.log(`${row.name}: ${row.goals}`)
  }

  console.log('\nTop assisters:')
  for (const row of [...summary.assisters].sort((a, b) => b.assists - a.assists || a.name.localeCompare(b.name))) {
    console.log(`${row.name}: ${row.assists}`)
  }
}

const toCountMap = (entries, keyName) =>
  new Map(entries.map((entry) => [normalizeName(entry.name), entry[keyName]]))

const assertExactCounts = (label, actualRows, expectedRows, keyName) => {
  const actualMap = toCountMap(actualRows, keyName)
  const expectedMap = toCountMap(expectedRows, keyName)
  const mismatches = []

  for (const expected of expectedRows) {
    const actualValue = actualMap.get(normalizeName(expected.name)) ?? 0
    if (actualValue !== expected[keyName]) {
      mismatches.push(`${expected.name}: expected ${expected[keyName]}, got ${actualValue}`)
    }
  }

  for (const actual of actualRows) {
    if (!expectedMap.has(normalizeName(actual.name))) {
      mismatches.push(`${actual.name}: unexpected ${keyName}=${actual[keyName]}`)
    }
  }

  if (mismatches.length > 0) {
    throw new Error(`${label} validation failed:\n${mismatches.join('\n')}`)
  }
}

const expectedScorers = [
  { name: 'הנרי גנגה', goals: 20 },
  { name: 'זיו אושבייב', goals: 10 },
  { name: "מואמן חאג' יחיא", goals: 9 },
  { name: 'מאמון שייח יוסף', goals: 7 },
  { name: 'מוחמד בראנסי', goals: 7 },
  { name: 'עדיאל אלון', goals: 7 },
  { name: 'ודיע פדילה', goals: 6 },
  { name: 'מואמן נאסר', goals: 6 },
  { name: 'דניאל וולסמן', goals: 6 },
  { name: 'יובל שלמה', goals: 6 },
  { name: 'טל עמוס', goals: 6 },
  { name: 'סעיד שיך יוסף', goals: 5 },
  { name: "סירג' מסרואה", goals: 5 },
  { name: 'אסי סגל', goals: 5 },
  { name: 'ליאור פרידמן', goals: 5 },
  { name: 'מתן עופר', goals: 4 },
  { name: 'עומאר אבו חיט', goals: 3 },
  { name: 'חוסיין נאסר', goals: 2 },
  { name: 'כרם שביטה', goals: 1 },
  { name: 'עבד מנסור', goals: 1 },
  { name: 'שי שמחיוב', goals: 1 },
  { name: 'עבד אליהו', goals: 1 },
  { name: 'הדר שפיבק', goals: 1 },
  { name: 'אוס עבד אל רחים', goals: 1 },
  { name: 'בן גמליאל', goals: 1 },
]

const expectedAssisters = [
  { name: 'טל עמוס', assists: 10 },
  { name: 'יובל שלמה', assists: 6 },
  { name: 'דניאל וולסמן', assists: 5 },
  { name: 'מוחמד בראנסי', assists: 5 },
  { name: 'הנרי גנגה', assists: 5 },
  { name: 'חוסיין נאסר', assists: 4 },
  { name: 'עומאר אבו חיט', assists: 4 },
  { name: 'שי שמחיוב', assists: 4 },
  { name: 'ליאור פרידמן', assists: 4 },
  { name: 'מתן עופר', assists: 4 },
  { name: 'סעיד שיך יוסף', assists: 3 },
  { name: 'ודיע פדילה', assists: 3 },
  { name: 'זיו אושבייב', assists: 3 },
  { name: 'מתן שגב', assists: 3 },
  { name: 'אוס עבד אל רחים', assists: 3 },
  { name: "מואמן חאג' יחיא", assists: 3 },
  { name: 'עדיאל אלון', assists: 3 },
  { name: 'אסי סגל', assists: 2 },
  { name: 'מאמון שייח יוסף', assists: 2 },
  { name: "סירג' מסרואה", assists: 2 },
  { name: 'עבד אליהו', assists: 2 },
  { name: 'מואמן נאסר', assists: 1 },
  { name: 'עבד מנסור', assists: 1 },
  { name: 'הדר שפיבק', assists: 1 },
  { name: 'מועד שחאדה', assists: 1 },
]

const rosterBlueprint = {
  זאבים: [
    { name: 'הנרי גנגה', goals: 20, assists: 5 },
    { name: "מואמן חאג' יחיא", goals: 9, assists: 3 },
    { name: 'דניאל וולסמן', goals: 6, assists: 5 },
    { name: 'עומאר אבו חיט', goals: 3, assists: 4 },
    { name: 'חוסיין נאסר', goals: 2, assists: 4 },
    { name: 'מתן שגב', goals: 0, assists: 3 },
  ],
  אריות: [
    { name: 'זיו אושבייב', goals: 10, assists: 3 },
    { name: 'ודיע פדילה', goals: 6, assists: 3 },
    { name: 'אסי סגל', goals: 5, assists: 2 },
    { name: 'שי שמחיוב', goals: 1, assists: 4 },
    { name: 'עבד אליהו', goals: 1, assists: 2 },
    { name: 'הדר שפיבק', goals: 1, assists: 1 },
    { name: 'אוס עבד אל רחים', goals: 1, assists: 3 },
  ],
  דרקונים: [
    { name: 'עדיאל אלון', goals: 7, assists: 3 },
    { name: 'יובל שלמה', goals: 6, assists: 6 },
    { name: 'טל עמוס', goals: 6, assists: 10 },
    { name: "סירג' מסרואה", goals: 5, assists: 2 },
    { name: 'ליאור פרידמן', goals: 5, assists: 4 },
    { name: 'מתן עופר', goals: 4, assists: 4 },
    { name: 'בן גמליאל', goals: 1, assists: 0 },
  ],
  נשרים: [
    { name: 'מוחמד בראנסי', goals: 7, assists: 5 },
    { name: 'מאמון שייח יוסף', goals: 7, assists: 2 },
    { name: 'מואמן נאסר', goals: 6, assists: 1 },
    { name: 'סעיד שיך יוסף', goals: 5, assists: 3 },
    { name: 'כרם שביטה', goals: 1, assists: 0 },
    { name: 'עבד מנסור', goals: 1, assists: 1 },
    { name: 'מועד שחאדה', goals: 0, assists: 1 },
  ],
}

const tournamentBlueprint = [
  { leagueNumber: 1, date: '2026-02-21' },
  { leagueNumber: 2, date: '2026-03-07' },
  { leagueNumber: 3, date: '2026-03-14' },
  { leagueNumber: 4, date: '2026-03-28' },
]

const matchBlueprint = [
  { leagueNumber: 1, round: 1, time: '20:00', teamA: 'זאבים', teamB: 'דרקונים', score: { a: 13, b: 6 } },
  { leagueNumber: 1, round: 2, time: '21:00', teamA: 'אריות', teamB: 'נשרים', score: { a: 6, b: 4 } },
  { leagueNumber: 2, round: 1, time: '20:00', teamA: 'אריות', teamB: 'זאבים', score: { a: 7, b: 9 } },
  { leagueNumber: 2, round: 2, time: '21:00', teamA: 'דרקונים', teamB: 'נשרים', score: { a: 7, b: 13 } },
  { leagueNumber: 3, round: 1, time: '20:00', teamA: 'אריות', teamB: 'דרקונים', score: { a: 6, b: 7 } },
  { leagueNumber: 3, round: 2, time: '21:00', teamA: 'נשרים', teamB: 'זאבים', score: { a: 8, b: 11 } },
  { leagueNumber: 4, round: 1, time: '20:00', teamA: 'אריות', teamB: 'נשרים', score: { a: 6, b: 2 } },
  { leagueNumber: 4, round: 2, time: '21:00', teamA: 'זאבים', teamB: 'דרקונים', score: { a: 7, b: 14 } },
]

const teamOrder = ['נשרים', 'אריות', 'דרקונים', 'זאבים']
const defaultTeamColors = { נשרים: 'black', אריות: 'yellow', דרקונים: 'pink', זאבים: 'orange' }

const manualAliases = {
  'הנרי גנגה': ['הנרי'],
  'זיו אושבייב': ['זיו'],
  "מואמן חאג' יחיא": ['מואמן חאג יחיא', 'מואמן חאג', 'מואמן חג יחיא'],
  'דניאל וולסמן': ['דניאל', 'וולסמן'],
  'עומאר אבו חיט': ['עומאר'],
  'חוסיין נאסר': ['חוסיין'],
  'מוחמד בראנסי': ['מוחמד'],
  'מאמון שייח יוסף': ['מאמון שיך יוסף', 'מאמון שייח', 'מאמון שיך'],
  'סעיד שיך יוסף': ['סעיד שייח יוסף', 'סעיד שיך', 'סעיד'],
  'כרם שביטה': ['כרם'],
  'הדר שפיבק': ['שפיבק'],
  'אוס עבד אל רחים': ['אוס עבד אלרחים', 'אוס עבד אל רחים', 'אוס'],
  'ודיע פדילה': ['ודיע'],
  'עדיאל אלון': ['עדיאל'],
  'יובל שלמה': ['יובל'],
  'טל עמוס': ['טל'],
  "סירג' מסרואה": ['סירג מסרואה', 'סירג'],
  'ליאור פרידמן': ['פרידמן', 'פרדימן'],
}

const allRosterNames = Object.values(rosterBlueprint).flat().map((player) => player.name)

const isUniqueBlueprintIdentifier = (shortValue, targetName) => {
  const normalizedShort = normalizeName(shortValue)
  if (!normalizedShort) return false

  const matches = allRosterNames.filter((name) => {
    const normalizedName = normalizeName(name)
    return normalizedName.includes(normalizedShort) || normalizedShort.includes(normalizedName)
  })

  return matches.length === 1 && normalizeName(matches[0]) === normalizeName(targetName)
}

const compareCandidates = (a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name) || a.player.id.localeCompare(b.player.id)

const findLeague = (leagues) =>
  (leagues ?? []).find((entry) => entry.name === PREFERRED_LEAGUE_NAME) ??
  (leagues ?? []).find((entry) => entry.name?.includes(LEAGUE_NAME_FRAGMENT))

const getLeagueState = async () => {
  try {
    const [leagues, players, tournaments, matches] = await Promise.all([
      request('leagues?select=id,name,type,season_label,allow_roster_edits,teams,created_at'),
      request('players?select=id,name,league_id,is_offense,is_defense,created_at'),
      request('tournaments?select=id,date,league_number,league_id,year,teams,created_at,updated_at&order=league_number.asc,date.asc'),
      request('matches?select=id,tournament_id,league_id,round,team_a,team_b,score,events,created_at&order=tournament_id.asc,round.asc,id.asc'),
    ])

    const league = findLeague(leagues)
    if (!league) {
      throw new Error(`Could not find a dev league whose name includes "${LEAGUE_NAME_FRAGMENT}"`)
    }

    return {
      league,
      players: (players ?? []).filter((player) => player.league_id === league.id),
      tournaments: (tournaments ?? []).filter((tournament) => tournament.league_id === league.id),
      matches: (matches ?? []).filter((match) => match.league_id === league.id),
    }
  } catch (error) {
    if (!DRY_RUN) throw error
    console.warn(`Using fallback league metadata for dry-run: ${error.message}`)
    return {
      league: FALLBACK_LEAGUE,
      players: [],
      tournaments: [],
      matches: [],
    }
  }
}

const getBaseTeams = (league, tournaments) => {
  const firstTournament = [...(tournaments ?? [])]
    .filter((tournament) => tournament.league_number === 1)
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))[0]

  const sourceTeams = firstTournament?.teams?.length ? firstTournament.teams : league.teams?.length ? league.teams : FALLBACK_LEAGUE.teams
  const byName = new Map((sourceTeams ?? []).map((team) => [team.name, team]))

  return teamOrder.map((teamName) => {
    const source = byName.get(teamName)
    return {
      id: source?.id ?? `league5-team-${slug(teamName)}`,
      name: teamName,
      color: source?.color ?? defaultTeamColors[teamName],
      players: Array.isArray(source?.players) ? [...source.players] : [],
    }
  })
}

const buildTeamMembership = (teams) => {
  const membership = new Map()
  for (const team of teams) {
    for (const playerId of team.players ?? []) {
      membership.set(playerId, team.name)
    }
  }
  return membership
}

const resolveExistingPlayer = (targetName, teamName, existingPlayers, teamMembership, usedIds) => {
  const normalizedTarget = normalizeName(targetName)
  const aliases = [targetName, ...(manualAliases[targetName] ?? [])].map(normalizeName)
  const candidates = []

  for (const player of existingPlayers) {
    if (usedIds.has(player.id)) continue
    const normalizedExisting = normalizeName(player.name)
    if (!normalizedExisting) continue

    let score = -1
    if (aliases.includes(normalizedExisting)) score = 120
    else if (normalizedExisting === normalizedTarget) score = 115
    else if (
      aliases.some(
        (alias) =>
          (alias.includes(normalizedExisting) || normalizedExisting.includes(alias)) &&
          isUniqueBlueprintIdentifier(normalizedExisting.length <= alias.length ? normalizedExisting : alias, targetName),
      )
    ) {
      score = 100
    } else if (
      (normalizedExisting.includes(normalizedTarget) || normalizedTarget.includes(normalizedExisting)) &&
      isUniqueBlueprintIdentifier(
        normalizedExisting.length <= normalizedTarget.length ? normalizedExisting : normalizedTarget,
        targetName,
      )
    ) {
      score = 90
    }

    if (score < 0) continue

    if (teamMembership.get(player.id) === teamName) score += 20
    score -= Math.abs(normalizedExisting.length - normalizedTarget.length)
    candidates.push({ player, score })
  }

  candidates.sort(compareCandidates)
  return candidates[0]?.player ?? null
}

const allocatePlayers = (baseTeams, existingPlayers, leagueId) => {
  const teamMembership = buildTeamMembership(baseTeams)
  const usedExistingIds = new Set()
  const resolvedPlayers = []
  const mappings = []

  for (const teamName of teamOrder) {
    for (const playerInfo of rosterBlueprint[teamName]) {
      const matched = resolveExistingPlayer(playerInfo.name, teamName, existingPlayers, teamMembership, usedExistingIds)
      const id = matched?.id ?? `league5-${slug(playerInfo.name)}`
      if (matched) usedExistingIds.add(matched.id)

      resolvedPlayers.push({
        id,
        name: matched?.name ?? playerInfo.name,
        league_id: leagueId,
        is_offense: playerInfo.goals > 0 || playerInfo.assists >= 2,
        is_defense: playerInfo.goals === 0 || playerInfo.assists <= 2,
      })

      mappings.push({
        teamName,
        requestedName: playerInfo.name,
        actualName: matched?.name ?? playerInfo.name,
        id,
        reused: Boolean(matched),
      })
    }
  }

  return { players: resolvedPlayers, mappings }
}

const buildTeams = (baseTeams, players) => {
  const playersByRequestedName = new Map()
  for (const player of players) {
    const normalized = normalizeName(player.name)
    playersByRequestedName.set(normalized, player.id)
  }

  return baseTeams.map((team) => ({
    ...team,
    players: rosterBlueprint[team.name]
      .map((playerInfo) => {
        const normalizedRequested = normalizeName(playerInfo.name)
        return players.find(
          (player) =>
            normalizeName(player.name) === normalizedRequested ||
            normalizeName(playerInfo.name) === normalizeName(player.name) ||
            normalizeName(playerInfo.name).includes(normalizeName(player.name)) ||
            normalizeName(player.name).includes(normalizeName(playerInfo.name)),
        )?.id
      })
      .filter(Boolean),
  }))
}

const buildTournamentRows = (league, existingTournaments, teams) => {
  const existingById = new Map(existingTournaments.map((tournament) => [tournament.id, tournament]))
  return tournamentBlueprint.map((entry) => {
    const expectedId = `league5-${entry.date}`
    const existing = existingById.get(expectedId)
    const resolvedDate = existing?.date ?? entry.date
    return {
      id: expectedId,
      date: resolvedDate,
      league_number: entry.leagueNumber,
      league_id: league.id,
      year: existing?.year ?? DEFAULT_YEAR,
      teams,
    }
  })
}

const buildMatches = (tournamentRows, teams, playerIdByRequestedName) => {
  const teamIdByName = Object.fromEntries(teams.map((team) => [team.name, team.id]))
  const tournamentByNumber = new Map(tournamentRows.map((tournament) => [tournament.league_number, tournament]))

  const matchesByTeam = Object.fromEntries(
    teamOrder.map((teamName) => [
      teamName,
      matchBlueprint.filter((match) => match.teamA === teamName || match.teamB === teamName),
    ]),
  )

  for (const teamName of teamOrder) {
    for (const playerInfo of rosterBlueprint[teamName]) {
      if (!playerIdByRequestedName[playerInfo.name]) {
        throw new Error(`Failed to resolve player id for ${playerInfo.name}`)
      }
    }
  }

  const teamEventsByMatchKey = new Map(matchBlueprint.map((match) => [`${match.leagueNumber}-${match.round}`, []]))

  for (const [teamName, roster] of Object.entries(rosterBlueprint)) {
    const teamId = teamIdByName[teamName]
    const goalTotalsByPlayerId = Object.fromEntries(
      roster.filter((player) => player.goals > 0).map((player) => [playerIdByRequestedName[player.name], player.goals]),
    )
    const assistTotalsByPlayerId = Object.fromEntries(
      roster.filter((player) => player.assists > 0).map((player) => [playerIdByRequestedName[player.name], player.assists]),
    )
    const matchGoalCounts = matchesByTeam[teamName].map((match) => (match.teamA === teamName ? match.score.a : match.score.b))

    const goalSequences = buildGoalSequence(goalTotalsByPlayerId, matchGoalCounts)
    const eventsByMatch = goalSequences.map((scorers) =>
      scorers.map((scorer) => ({
        type: 'goal',
        teamId,
        scorer,
      })),
    )

    assignAssists(eventsByMatch, assistTotalsByPlayerId)

    matchesByTeam[teamName].forEach((match, index) => {
      teamEventsByMatchKey.get(`${match.leagueNumber}-${match.round}`).push(...eventsByMatch[index])
    })
  }

  return matchBlueprint.map((match) => {
    const tournament = tournamentByNumber.get(match.leagueNumber)
    return {
      id: `${tournament.id}-g${match.round}`,
      tournament_id: tournament.id,
      league_id: tournament.league_id,
      round: match.round,
      team_a: teamIdByName[match.teamA],
      team_b: teamIdByName[match.teamB],
      score: match.score,
      events: [
        { type: '_meta', description: `${tournament.date} ${match.time}`, clockSeconds: 3000 },
        ...teamEventsByMatchKey.get(`${match.leagueNumber}-${match.round}`),
      ],
    }
  })
}

const buildTournamentSummary = (tournamentRows, matchRows, players) =>
  tournamentRows.map((tournament) => ({
    ...tournament,
    games: matchRows
      .filter((match) => match.tournament_id === tournament.id)
      .map((match) => ({
        id: match.id,
        teamA: match.team_a,
        teamB: match.team_b,
        score: match.score,
        events: match.events.filter((event) => event.type === 'goal'),
      })),
  }))

const toTournamentRow = (tournament) => ({
  id: tournament.id,
  date: tournament.date,
  league_number: tournament.league_number,
  league_id: tournament.league_id,
  year: tournament.year,
  teams: tournament.teams,
})

const toMatchRow = (match) => ({
  id: match.id,
  tournament_id: match.tournament_id,
  league_id: match.league_id,
  round: match.round,
  team_a: match.team_a,
  team_b: match.team_b,
  score: match.score,
  events: match.events,
})

const deleteExistingWeeks = async (existingTournaments) => {
  const targetTournamentIds = new Set(tournamentBlueprint.map((entry) => `league5-${entry.date}`))
  const targetTournaments = existingTournaments.filter((tournament) => targetTournamentIds.has(tournament.id))
  if (targetTournaments.length === 0) return

  const tournamentIds = targetTournaments.map((tournament) => tournament.id)
  await request(`matches?tournament_id=in.(${buildInFilter(tournamentIds)})`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
  await request(`tournaments?id=in.(${buildInFilter(tournamentIds)})`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
}

const { league, players: existingPlayers, tournaments: existingTournaments, matches: existingMatches } = await getLeagueState()
const baseTeams = getBaseTeams(league, existingTournaments)
const { players, mappings } = allocatePlayers(baseTeams, existingPlayers, league.id)
const playerIdByRequestedName = Object.fromEntries(mappings.map((mapping) => [mapping.requestedName, mapping.id]))
const canonicalPlayers = mappings.map((mapping) => ({
  id: mapping.id,
  name: mapping.requestedName,
}))
const teams = buildTeams(baseTeams, players)
const tournaments = buildTournamentRows(league, existingTournaments, teams)
const matches = buildMatches(tournaments, teams, playerIdByRequestedName)
const scriptedTournamentIds = new Set(tournaments.map((tournament) => tournament.id))
const extraTournaments = existingTournaments.filter((tournament) => !scriptedTournamentIds.has(tournament.id))
const extraMatches = existingMatches.filter((match) => !scriptedTournamentIds.has(match.tournament_id))

const localSummary = validateDataset({
  teams,
  players: canonicalPlayers,
  tournaments: buildTournamentSummary(tournaments, matches, players),
})

assertExactCounts('Scorers', localSummary.scorers, expectedScorers, 'goals')
assertExactCounts('Assisters', localSummary.assisters, expectedAssisters, 'assists')

printSummary('Planned league 5 data', localSummary)
if (extraTournaments.length > 0) {
  console.log(`\nKeeping ${extraTournaments.length} existing additional tournament(s): ${extraTournaments.map((t) => `${t.id} (${t.date})`).join(', ')}`)
}

console.log('\nPlayer mapping:')
for (const mapping of mappings) {
  console.log(`${mapping.teamName} | ${mapping.requestedName} -> ${mapping.actualName} (${mapping.reused ? 'reused' : 'created'})`)
}

if (DRY_RUN) {
  console.log('\nDry run only. No data was written.')
  process.exit(0)
}

await deleteExistingWeeks(existingTournaments)

await request('leagues', {
  method: 'POST',
  headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
  body: JSON.stringify([
    {
      id: league.id,
      name: PREFERRED_LEAGUE_NAME,
      type: league.type ?? 'regular',
      season_label: league.season_label ?? String(DEFAULT_YEAR),
      allow_roster_edits: league.allow_roster_edits === true,
      teams,
    },
  ]),
})

await request('players', {
  method: 'POST',
  headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
  body: JSON.stringify(players),
})

await request('tournaments', {
  method: 'POST',
  headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
  body: JSON.stringify([...extraTournaments.map(toTournamentRow), ...tournaments]),
})

await request('matches', {
  method: 'POST',
  headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
  body: JSON.stringify([...extraMatches.map(toMatchRow), ...matches]),
})

console.log('\nDev league 5 data seeded successfully.')
