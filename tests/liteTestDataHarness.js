/**
 * Lite e2e test harness — resets the soccerlite_test schema and seeds the
 * well-known test leagues that lite.e2e.spec.js relies on.
 */
import process from 'node:process'
import { createHash } from 'node:crypto'
import '../scripts/lib/loadEnv.mjs'
import { resetDataset, seedDataset } from '../scripts/lib/supabaseAdmin.mjs'

// Force the test schema to the lite namespace regardless of what .env.local says.
// supabaseAdmin.mjs reads process.env lazily (inside functions) so this override
// takes effect even though ES module imports are hoisted.
process.env.SUPABASE_TEST_SCHEMA = 'soccerlite_test'

const usingSupabase = () => process.env.VITE_STORAGE_PROVIDER === 'supabase'

// LITE_TEST_LEAGUE_PASSWORD must be set in .env.local (gitignored).
// The playwright config loads .env.local via loadEnv before tests run.
const testPass = process.env.LITE_TEST_LEAGUE_PASSWORD?.trim()
if (!testPass) {
  throw new Error('LITE_TEST_LEAGUE_PASSWORD is not set. Add it to .env.local before running lite e2e tests.')
}

// DB stores the SHA-256 hash; the browser hashes user input before comparing.
const testPassHash = createHash('sha256').update(testPass).digest('hex')

/** Well-known lite league used in all test scenarios. */
export const LITE_TEST_LEAGUE = {
  id: 'my-test-league',
  name: 'My Test League',
  type: 'tournament',
  seasonLabel: '',
  allowRosterEdits: false,
  teams: [],
  adminPassword: testPassHash,
}

/** Plaintext password — typed into the password form by e2e tests. */
export const LITE_TEST_PASS = testPass

export const resetLiteTestData = async () => {
  if (!usingSupabase()) return
  await resetDataset('test')
  await seedDataset('test', [LITE_TEST_LEAGUE], [], [])
}
