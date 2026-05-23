/**
 * Playwright configuration for Soccer Lite e2e tests.
 * Run with: npm run lite:test:e2e
 */
import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'

const localEnv = loadEnv('', process.cwd(), '')
for (const [key, value] of Object.entries(localEnv)) {
  if (!(key in process.env)) process.env[key] = value
}

// Enforce lite test dataset
if (process.env.VITE_DEFAULT_DATASET !== 'test') {
  throw new Error('Lite e2e requires VITE_DEFAULT_DATASET=test. Run: npm run lite:test:e2e')
}

export default defineConfig({
  testDir: './tests',
  testMatch: '**/lite.e2e.spec.js',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-lite',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      ...process.env,
      VITE_LITE_MODE: 'true',
      VITE_DEFAULT_DATASET: 'test',
      VITE_ENABLE_PROD_DATASET: 'false',
      VITE_SUPABASE_DEV_SCHEMA: 'soccerlite_dev',
      VITE_SUPABASE_TEST_SCHEMA: 'soccerlite_test',
      VITE_SUPABASE_PROD_SCHEMA: 'soccerlite_prod',
    },
  },
})
