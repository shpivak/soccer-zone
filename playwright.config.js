import { defineConfig, devices } from '@playwright/test'

if (process.env.VITE_DEFAULT_DATASET !== 'test') {
  throw new Error('Playwright e2e requires VITE_DEFAULT_DATASET=test. Run: npm run test:e2e')
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      ...process.env,
      VITE_DEFAULT_DATASET: 'test',
    },
  },
})
