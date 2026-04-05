#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CURRENT_FILE = resolve(import.meta.dirname, '..', '..', 'sql', 'dev-backups', 'soccer_zone_dev_backup_2026-04-04_pre_merge.sql')
const HISTORICAL_FILE = resolve(import.meta.dirname, '..', '..', 'sql', 'dev-backups', 'soccer_zone_dev_backup_2026-04-03.sql')
const OUTPUT_FILE = resolve(import.meta.dirname, '..', '..', 'sql', 'dev-backups', 'soccer_zone_dev_backup_2026-04-04_combined.sql')
const LEAGUE_ID = 'league-1774816188496'

const currentSql = readFileSync(CURRENT_FILE, 'utf8')
const historicalSql = readFileSync(HISTORICAL_FILE, 'utf8')

const parseSections = (sql) => {
  const lines = sql.split('\n')
  const header = []
  const leagues = []
  const players = []
  const tournaments = []
  const matches = []
  let section = 'header'

  for (const line of lines) {
    if (line === '-- leagues') {
      section = 'leagues'
      continue
    }
    if (line === '-- players') {
      section = 'players'
      continue
    }
    if (line === '-- tournaments') {
      section = 'tournaments'
      continue
    }
    if (line === '-- matches') {
      section = 'matches'
      continue
    }

    if (!line.trim()) {
      if (section === 'header') header.push(line)
      continue
    }

    if (!line.startsWith('INSERT INTO ')) {
      if (section === 'header') header.push(line)
      continue
    }

    if (section === 'leagues') leagues.push(line)
    else if (section === 'players') players.push(line)
    else if (section === 'tournaments') tournaments.push(line)
    else if (section === 'matches') matches.push(line)
  }

  return { header, leagues, players, tournaments, matches }
}

const current = parseSections(currentSql)
const historical = parseSections(historicalSql)

const historicalLeaguePlayers = historical.players.filter((line) => line.includes(`'${LEAGUE_ID}'`))
const historicalLeagueTournaments = historical.tournaments.filter((line) => line.includes(`'${LEAGUE_ID}'`))
const historicalLeagueMatches = historical.matches.filter((line) => line.includes(`'${LEAGUE_ID}'`))

const merged = {
  leagues: current.leagues,
  players: [...current.players, ...historicalLeaguePlayers],
  tournaments: [...current.tournaments, ...historicalLeagueTournaments],
  matches: [...current.matches, ...historicalLeagueMatches],
}

const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
const header = [
  `-- Soccer Zone DEV combined backup — ${now}`,
  '-- Schema: soccer_zone_dev',
  `-- Rows: leagues=${merged.leagues.length}, players=${merged.players.length}, tournaments=${merged.tournaments.length}, matches=${merged.matches.length}`,
  '',
  'SET search_path TO soccer_zone_dev;',
  '',
]

const out = [
  ...header,
  '-- leagues',
  ...merged.leagues,
  '',
  '-- players',
  ...merged.players,
  '',
  '-- tournaments',
  ...merged.tournaments,
  '',
  '-- matches',
  ...merged.matches,
  '',
].join('\n')

writeFileSync(OUTPUT_FILE, out, 'utf8')
console.log(`Wrote ${OUTPUT_FILE}`)
console.log(`leagues=${merged.leagues.length}, players=${merged.players.length}, tournaments=${merged.tournaments.length}, matches=${merged.matches.length}`)
