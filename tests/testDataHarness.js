import process from 'node:process'
import '../scripts/lib/loadEnv.mjs'
import { resetDataset, seedDataset } from '../scripts/lib/supabaseAdmin.mjs'
import { defaultLeagues, defaultPlayers, defaultTournaments } from '../scripts/lib/mockData.mjs'

const usingSupabase = () => process.env.VITE_STORAGE_PROVIDER === 'supabase'

export const resetTestData = async () => {
  if (!usingSupabase()) return

  await resetDataset('test')
  await seedDataset('test', defaultLeagues, defaultPlayers, defaultTournaments)
}
