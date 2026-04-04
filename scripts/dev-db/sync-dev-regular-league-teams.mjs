#!/usr/bin/env node
import '../lib/loadEnv.mjs'

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim()
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const SCHEMA = process.env.SUPABASE_DEV_SCHEMA?.trim() || process.env.VITE_SUPABASE_DEV_SCHEMA?.trim() || 'soccer_zone_dev'
const LEAGUE_NAME_FRAGMENT = 'ליגת סוקרזון 5'

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

const leagues = await request('leagues?select=id,name,type,season_label,allow_roster_edits,teams,created_at')
const league = (leagues ?? []).find((entry) => entry.name?.includes(LEAGUE_NAME_FRAGMENT))
if (!league) {
  throw new Error(`Could not find a league whose name includes "${LEAGUE_NAME_FRAGMENT}"`)
}

const tournaments = await request(
  `tournaments?select=id,date,league_number,league_id,year,teams,created_at,updated_at&league_id=eq.${encodeURIComponent(league.id)}&order=league_number.asc,date.asc,id.asc`,
)

const firstTournament = (tournaments ?? []).find((tournament) => (tournament.teams?.length ?? 0) > 0)
const baseTeams = firstTournament?.teams ?? league.teams ?? []
if (baseTeams.length === 0) {
  throw new Error('No source teams found on the league or first tournament')
}

await request('leagues', {
  method: 'POST',
  headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
  body: JSON.stringify([
    {
      id: league.id,
      name: league.name,
      type: league.type,
      season_label: league.season_label,
      allow_roster_edits: league.allow_roster_edits === true,
      teams: baseTeams,
    },
  ]),
})

if ((tournaments ?? []).length > 0) {
  await request('tournaments', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify(
      tournaments.map((tournament) => ({
        id: tournament.id,
        date: tournament.date,
        league_number: tournament.league_number,
        league_id: tournament.league_id,
        year: tournament.year,
        teams: baseTeams,
      })),
    ),
  })
}

console.log(`Synced ${league.name} teams from ${firstTournament?.id ?? 'league row'} to ${tournaments?.length ?? 0} tournaments.`)
