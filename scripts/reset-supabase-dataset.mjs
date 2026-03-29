import './lib/loadEnv.mjs'
import { defaultLeagues, defaultPlayers, defaultTournaments } from './lib/mockData.mjs'
import { resetDataset, seedDataset } from './lib/supabaseAdmin.mjs'

const dataset = process.env.SUPABASE_TARGET_DATASET || 'test'
const allowProd = process.env.ALLOW_PROD_DB_RESET === 'true'
const withSeed = process.env.SEED_AFTER_RESET !== 'false'

await resetDataset(dataset, { allowProd })

if (withSeed) {
  await seedDataset(dataset, defaultLeagues, defaultPlayers, defaultTournaments, { allowProd })
}

console.log(`Reset ${dataset}${withSeed ? ' and re-seeded default data' : ''}.`)
