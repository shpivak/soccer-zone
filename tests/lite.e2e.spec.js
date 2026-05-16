/**
 * Soccer Lite — end-to-end test suite.
 *
 * Tests the lite-mode path-based routing, per-league auth, league creation,
 * and the core live/stats flow.  Requires VITE_LITE_MODE=true and the
 * soccerlite_test schema to be seeded (handled automatically via beforeEach).
 *
 * Run with: npm run lite:test:e2e
 */
import { expect, test } from '@playwright/test'
import { LITE_TEST_LEAGUE, LITE_TEST_PASS, resetLiteTestData } from './liteTestDataHarness'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Navigate to a lite league URL, optionally injecting the session storage path
 * that 404.html would have set (simulates GitHub Pages redirect).
 */
const gotoLeague = async (page, slug, { pass } = {}) => {
  // Simulate the 404.html redirect: store the path in sessionStorage then
  // navigate to the app root.  The app reads __lite_redirect_path on mount.
  await page.goto('/')
  await page.evaluate((p) => sessionStorage.setItem('__lite_redirect_path', p), `/${slug}`)
  const url = pass ? `/?pass=${encodeURIComponent(pass)}` : '/'
  await page.goto(url)
}

const waitForApp = async (page) => {
  // Either the live tab becomes visible or an auth/setup screen is shown
  await page.waitForLoadState('networkidle')
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

test.beforeEach(async () => {
  await resetLiteTestData()
})

// ─── Auth flow ────────────────────────────────────────────────────────────────

test('shows password screen for existing league without ?pass', async ({ page }) => {
  await gotoLeague(page, LITE_TEST_LEAGUE.id)
  await waitForApp(page)
  await expect(page.getByTestId('lite-password-screen')).toBeVisible()
})

test('wrong password shows error', async ({ page }) => {
  await gotoLeague(page, LITE_TEST_LEAGUE.id)
  await waitForApp(page)
  await page.getByTestId('lite-password-input').fill('wrongpassword')
  await page.getByTestId('lite-password-submit').click()
  await expect(page.getByTestId('lite-password-error')).toBeVisible()
  // Still on password screen
  await expect(page.getByTestId('lite-password-screen')).toBeVisible()
})

test('correct password authenticates and shows live tab', async ({ page }) => {
  await gotoLeague(page, LITE_TEST_LEAGUE.id)
  await waitForApp(page)
  await page.getByTestId('lite-password-input').fill(LITE_TEST_PASS)
  await page.getByTestId('lite-password-submit').click()
  await expect(page.getByTestId('nav-live')).toBeVisible()
  await expect(page.getByTestId('lite-league-name')).toContainText(LITE_TEST_LEAGUE.name)
})

test('?pass= URL param auto-authenticates', async ({ page }) => {
  await gotoLeague(page, LITE_TEST_LEAGUE.id, { pass: LITE_TEST_PASS })
  await waitForApp(page)
  await expect(page.getByTestId('nav-live')).toBeVisible()
  // Password screen should NOT be shown
  await expect(page.getByTestId('lite-password-screen')).not.toBeVisible()
})

test('cached password in localStorage skips password screen on reload', async ({ page }) => {
  // First visit: authenticate via password form
  await gotoLeague(page, LITE_TEST_LEAGUE.id)
  await waitForApp(page)
  await page.getByTestId('lite-password-input').fill(LITE_TEST_PASS)
  await page.getByTestId('lite-password-submit').click()
  await expect(page.getByTestId('nav-live')).toBeVisible()

  // Second visit: localStorage has the cached password — no screen shown
  await gotoLeague(page, LITE_TEST_LEAGUE.id)
  await waitForApp(page)
  await expect(page.getByTestId('nav-live')).toBeVisible()
  await expect(page.getByTestId('lite-password-screen')).not.toBeVisible()
})

test('cached password for one league does not grant access to another', async ({ page }) => {
  // Cache a password for the test league
  await gotoLeague(page, LITE_TEST_LEAGUE.id, { pass: LITE_TEST_PASS })
  await waitForApp(page)
  await expect(page.getByTestId('nav-live')).toBeVisible()

  // Navigate to a completely different (unknown) league slug
  await gotoLeague(page, 'totally-different-league')
  await waitForApp(page)
  // Should show setup screen (league doesn't exist) — not the app
  await expect(page.getByTestId('lite-setup-screen')).toBeVisible()
})

// ─── League creation ──────────────────────────────────────────────────────────

test('shows setup screen for unknown league slug', async ({ page }) => {
  await gotoLeague(page, 'brand-new-league-xyz')
  await waitForApp(page)
  await expect(page.getByTestId('lite-setup-screen')).toBeVisible()
})

test('wrong super password shows error on setup screen', async ({ page }) => {
  await gotoLeague(page, 'brand-new-league-xyz')
  await waitForApp(page)
  await page.getByTestId('lite-setup-name').fill('Brand New League')
  await page.getByTestId('lite-setup-league-pass').fill('mypassword')
  await page.getByTestId('lite-setup-super-pass').fill('wrongsuperpass')
  await page.getByTestId('lite-setup-submit').click()
  await expect(page.getByTestId('lite-setup-error')).toContainText('Invalid super password')
})

test('correct super password creates league and enters app', async ({ page }) => {
  await gotoLeague(page, 'brand-new-league-xyz')
  await waitForApp(page)
  await page.getByTestId('lite-setup-name').fill('Brand New League')
  await page.getByTestId('lite-setup-league-pass').fill('mypassword')
  const superPass = process.env.VITE_LITE_SUPER_PASSWORD
  await page.getByTestId('lite-setup-super-pass').fill(superPass)
  await page.getByTestId('lite-setup-submit').click()
  await expect(page.getByTestId('nav-live')).toBeVisible()
  await expect(page.getByTestId('lite-league-name')).toContainText('Brand New League')
})

// ─── Lite UI shape ────────────────────────────────────────────────────────────

test('no admin tab in lite mode', async ({ page }) => {
  await gotoLeague(page, LITE_TEST_LEAGUE.id, { pass: LITE_TEST_PASS })
  await waitForApp(page)
  await expect(page.getByTestId('nav-live')).toBeVisible()
  await expect(page.getByTestId('nav-stats')).toBeVisible()
  await expect(page.getByTestId('nav-admin')).not.toBeVisible()
})

test('no league selector dropdown in lite mode', async ({ page }) => {
  await gotoLeague(page, LITE_TEST_LEAGUE.id, { pass: LITE_TEST_PASS })
  await waitForApp(page)
  await expect(page.getByTestId('league-select')).not.toBeVisible()
})

test('no coach login in lite mode', async ({ page }) => {
  await gotoLeague(page, LITE_TEST_LEAGUE.id, { pass: LITE_TEST_PASS })
  await waitForApp(page)
  await expect(page.getByTestId('coach-select-screen')).not.toBeVisible()
})

// ─── Core live flow (smoke) ────────────────────────────────────────────────────

test('can create a tournament in the authenticated lite league', async ({ page }) => {
  await gotoLeague(page, LITE_TEST_LEAGUE.id, { pass: LITE_TEST_PASS })
  await waitForApp(page)
  await page.getByTestId('nav-live').click()
  // Empty league — the "create first tournament" button should be visible
  const createBtn = page.getByTestId('create-tournament-empty')
  await expect(createBtn).toBeVisible()
  await createBtn.click()
  // After creation a date input should appear in the tournament header
  await expect(page.getByTestId('tournament-date-input')).toBeVisible()
})

test('stats tab is accessible in lite mode', async ({ page }) => {
  await gotoLeague(page, LITE_TEST_LEAGUE.id, { pass: LITE_TEST_PASS })
  await waitForApp(page)
  await page.getByTestId('nav-stats').click()
  // Stats page renders without error
  await expect(page.getByTestId('stats-page')).toBeVisible()
})
