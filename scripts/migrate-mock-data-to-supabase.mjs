import { defaultLeagues, defaultPlayers, defaultTournaments } from './lib/mockData.mjs'
import { resetDataset, seedDataset } from './lib/supabaseAdmin.mjs'

const dataset = process.env.SUPABASE_TARGET_DATASET || 'test'
const allowProd = process.env.ALLOW_PROD_DB_RESET === 'true'

await resetDataset(dataset, { allowProd })
await seedDataset(dataset, defaultLeagues, defaultPlayers, defaultTournaments, { allowProd })

console.log(`Seeded ${defaultLeagues.length} leagues, ${defaultPlayers.length} players and ${defaultTournaments.length} sessions into ${dataset}.`)
