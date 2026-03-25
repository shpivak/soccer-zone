import { defaultPlayers, defaultTournaments } from './lib/mockData.mjs'
import { resetDataset, seedDataset } from './lib/supabaseAdmin.mjs'

const dataset = process.env.SUPABASE_TARGET_DATASET || 'test'
const allowProd = process.env.ALLOW_PROD_DB_RESET === 'true'

await resetDataset(dataset, { allowProd })
await seedDataset(dataset, defaultPlayers, defaultTournaments, { allowProd })

console.log(`Seeded ${defaultPlayers.length} players and ${defaultTournaments.length} tournaments into ${dataset}.`)
