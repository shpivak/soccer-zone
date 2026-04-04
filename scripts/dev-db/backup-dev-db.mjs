#!/usr/bin/env node
/**
 * Backup the Soccer Zone dev database to a timestamped SQL file.
 * Usage: node scripts/dev-db/backup-dev-db.mjs
 * Credentials are read from .env / .env.local — do not commit tokens here.
 */
import '../lib/loadEnv.mjs'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim()
const schema = process.env.VITE_SUPABASE_DEV_SCHEMA?.trim() || 'soccer_zone_dev'

if (!supabaseUrl || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  'Accept-Profile': schema,
}

async function fetchTable(table) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/${table}?select=*&limit=10000&order=created_at.asc`,
    { headers },
  )
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`
  return `'${String(v).replace(/'/g, "''")}'`
}

function toUpserts(table, rows, cols) {
  const updateCols = cols.filter((c) => c !== 'id')
  return rows
    .map((row) => {
      const vals = cols.map((c) => sqlVal(row[c])).join(', ')
      const updates = updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')
      return `INSERT INTO ${schema}.${table} (${cols.join(', ')}) VALUES (${vals}) ON CONFLICT (id) DO UPDATE SET ${updates};`
    })
    .join('\n')
}

console.log(`Fetching ${schema}…`)
const [leagues, players, tournaments, matches] = await Promise.all([
  fetchTable('leagues'),
  fetchTable('players'),
  fetchTable('tournaments'),
  fetchTable('matches'),
])

const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
const dateTag = new Date().toISOString().slice(0, 10)

let sql = `-- Soccer Zone DEV backup — ${now}\n`
sql += `-- Schema: ${schema}\n`
sql += `-- Rows: leagues=${leagues.length}, players=${players.length}, tournaments=${tournaments.length}, matches=${matches.length}\n\n`
sql += `SET search_path TO ${schema};\n\n`

sql += `-- leagues\n`
sql += toUpserts('leagues', leagues, ['id', 'name', 'type', 'season_label', 'allow_roster_edits', 'teams', 'created_at'])
sql += '\n\n'

sql += `-- players\n`
sql += toUpserts('players', players, ['id', 'name', 'league_id', 'is_offense', 'is_defense', 'created_at'])
sql += '\n\n'

sql += `-- tournaments\n`
sql += toUpserts('tournaments', tournaments, [
  'id',
  'date',
  'league_number',
  'league_id',
  'year',
  'teams',
  'created_at',
  'updated_at',
])
sql += '\n\n'

sql += `-- matches\n`
sql += toUpserts('matches', matches, ['id', 'tournament_id', 'league_id', 'round', 'team_a', 'team_b', 'score', 'events', 'created_at'])
sql += '\n'

const outPath = resolve(import.meta.dirname, '..', '..', 'sql', 'dev-backups', `soccer_zone_dev_backup_${dateTag}.sql`)
writeFileSync(outPath, sql, 'utf8')
console.log(`✓ Written: ${outPath.split('/').pop()} (${(sql.length / 1024).toFixed(1)} KB)`)
console.log(`  leagues=${leagues.length}, players=${players.length}, tournaments=${tournaments.length}, matches=${matches.length}`)
