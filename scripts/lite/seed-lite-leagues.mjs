/**
 * Seed script for Soccer Lite — creates the known leagues in dev, test, or prod.
 *
 * All passwords are read from environment variables (never hardcoded).
 * Copy .env.lite.example → .env.local and fill in the LITE_* vars before running.
 *
 * Usage:
 *   npm run lite:db:seed:dev
 *   npm run lite:db:seed:test
 *   npm run lite:db:seed:prod
 */

import '../lib/loadEnv.mjs'
import { seedDataset } from '../lib/supabaseAdmin.mjs'

const dataset = process.argv[2] || 'dev'
const allowProd = process.env.ALLOW_PROD_DB_RESET === 'true' || process.env.ALLOW_PROD_WRITES === 'true'

const requirePass = (envVar) => {
  const val = process.env[envVar]?.trim()
  if (!val) throw new Error(`Missing required env var: ${envVar}. Add it to .env.local and try again.`)
  return val
}

/** Leagues that should exist per dataset — passwords come from env vars. */
const LITE_LEAGUES = {
  dev: () => [
    {
      id: 'my-dev-league',
      name: 'My Dev League',
      type: 'tournament',
      seasonLabel: '',
      allowRosterEdits: false,
      teams: [],
      adminPassword: requirePass('LITE_DEV_LEAGUE_PASSWORD'),
    },
  ],
  test: () => [
    {
      id: 'my-test-league',
      name: 'My Test League',
      type: 'tournament',
      seasonLabel: '',
      allowRosterEdits: false,
      teams: [],
      adminPassword: requirePass('LITE_TEST_LEAGUE_PASSWORD'),
    },
  ],
  prod: () => [
    {
      id: 'my-prod-league',
      name: 'My Prod League',
      type: 'tournament',
      seasonLabel: '',
      allowRosterEdits: false,
      teams: [],
      adminPassword: requirePass('LITE_PROD_LEAGUE_PASSWORD'),
    },
    {
      // friday-hodash is prod-only. Its password must be set as LITE_FRIDAY_HODASH_PASSWORD
      // in the CI/GH environment — it is NOT stored in .env.local.
      id: 'friday-hodash',
      name: 'Friday Hodash',
      type: 'tournament',
      seasonLabel: '',
      allowRosterEdits: false,
      teams: [],
      adminPassword: requirePass('LITE_FRIDAY_HODASH_PASSWORD'),
    },
  ],
}

if (!LITE_LEAGUES[dataset]) {
  console.error(`Unknown dataset "${dataset}". Use "dev", "test", or "prod".`)
  process.exit(1)
}

const leagues = LITE_LEAGUES[dataset]()
await seedDataset(dataset, leagues, [], [], { allowProd })

console.log(`Seeded ${leagues.map((l) => l.id).join(', ')} into soccerlite_${dataset}.`)
