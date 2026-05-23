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
    // Prod leagues are created through the app UI using the super password.
    // To seed additional prod leagues from this script, add them to a
    // gitignored file (e.g. .lite.prod.leagues.json) and read it here.
  ],
}

if (!LITE_LEAGUES[dataset]) {
  console.error(`Unknown dataset "${dataset}". Use "dev", "test", or "prod".`)
  process.exit(1)
}

const leagues = LITE_LEAGUES[dataset]()
await seedDataset(dataset, leagues, [], [], { allowProd })

console.log(`Seeded ${leagues.map((l) => l.id).join(', ')} into soccerlite_${dataset}.`)
