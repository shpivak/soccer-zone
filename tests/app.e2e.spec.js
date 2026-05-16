import { expect, test } from '@playwright/test'
import { resetTestData } from './testDataHarness'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')

const addPlayer = async (page, name) => {
  // Open the bench add-player toggle if the input isn't already visible
  const input = page.getByTestId('new-player-input')
  if (!(await input.isVisible())) {
    await page.getByTestId('bench-add-player-toggle').click()
  }
  await input.fill(name)
  // force: true bypasses pointer-interception from the fixed bottom nav bar
  await page.getByTestId('add-player-button').click({ force: true })
}

const addPlayers = async (page, names) => {
  for (const name of names) {
    await addPlayer(page, name)
  }
}

const dragPlayer = async (page, playerName, targetTestId) => {
  const chips = page.locator('[data-testid^="player-chip-"]')
  let source = chips.filter({ hasText: playerName }).first()

  if ((await source.count()) === 0) {
    source = chips.filter({ has: page.locator(`input[value="${playerName}"]`) }).first()
  }

  const target = page.getByTestId(targetTestId)
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await source.dispatchEvent('dragstart', { dataTransfer })
  await target.dispatchEvent('dragover', { dataTransfer })
  await target.dispatchEvent('drop', { dataTransfer })
}

const switchToDragMode = async (page) => {
  const draggingBtn = page.getByTestId('mode-toggle-dragging')
  if (await draggingBtn.isVisible()) {
    await draggingBtn.click()
  }
}

const setTeamPlayer = async (page, teamId, playerName, assigned = true) => {
  await switchToDragMode(page)
  await dragPlayer(page, playerName, assigned ? `team-card-${teamId}` : 'team-card-bench')
}

const enableAdminMode = async (page) => {
  // Admin mode is now derived from coach login (beforeEach sets __admin__).
  // Just make sure we're on the live tab so subsequent nav clicks are predictable.
  await page.getByTestId('nav-live').click()
}

// Parse coach credentials from VITE_COACHES env var (same format as the app)
const getCoachPassword = (coachId) => {
  const raw = process.env.VITE_COACHES ?? ''
  const entries = raw.split(';').filter(Boolean).map((p) => {
    const [id, , password] = p.trim().split(':')
    return { id: id.toLowerCase().trim(), password: password.trim() }
  })
  if (coachId === '__admin__') return process.env.VITE_ADMIN_PASSWORD ?? ''
  return entries.find((e) => e.id === coachId)?.password ?? ''
}

// Fill the coach login screen (dropdown + password) and submit
const loginAsCoach = async (page, coachId) => {
  await page.getByTestId('coach-login-select').selectOption(coachId)
  await page.getByTestId('coach-login-password').fill(getCoachPassword(coachId))
  await page.getByTestId('coach-login-submit').click()
}

const setScore = async (page, side, score) => {
  const display = page.getByTestId(`score-${side}-input`)
  const plus = page.getByTestId(`score-${side}-plus`)
  const minus = page.getByTestId(`score-${side}-minus`)
  const current = Number((await display.textContent())?.trim() ?? '0')

  if (current < score) {
    for (let index = current; index < score; index += 1) {
      await plus.click()
    }
    return
  }

  for (let index = current; index > score; index -= 1) {
    await minus.click()
  }
}

test.beforeEach(async ({ page }) => {
  await resetTestData()
  await page.addInitScript((appVersion) => {
    if (!sessionStorage.getItem('soccer-zone-e2e-bootstrapped')) {
      localStorage.clear()
      sessionStorage.setItem('soccer-zone-e2e-bootstrapped', 'true')
    }
    // Dismiss the "What's New" popup so it doesn't block test interactions
    localStorage.setItem('soccer-zone-whats-new-seen', appVersion)
    // Bypass coach selection screen — tests run as "all leagues" identity
    localStorage.setItem('soccer-zone-coach-id', '__admin__')
  }, packageJson.version)
  await page.goto('/')
  // Dismiss What's New modal if it shows (guards against dev-server version cache mismatch)
  await page.getByRole('button', { name: /יאללה נשחק/ }).click({ timeout: 2000 }).catch(() => {})
})

test.afterEach(async ({ page }) => {
  if (!page.isClosed()) {
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.close()
  }
  await resetTestData()
})

test('main navigation, dropdown labels, and tournament stats render for the selected league', async ({ page }) => {
  await expect(page.getByTestId('nav-live')).toBeVisible()
  await expect(page.getByTestId('live-standings-table')).toBeVisible()
  await expect(page.getByTestId('league-select')).toContainText('שישי צהריים (ליגת טורנירים)')
  await expect(page.getByTestId('league-select')).toContainText('ליגת סוקרזון 5 (ליגה סדירה)')
  await expect(page.getByRole('columnheader', { name: 'תיקו' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'הפסדים' })).toBeVisible()

  await page.getByTestId('league-select').selectOption('tournament-3')
  await expect(page.locator('[data-testid="tournament-select"] option')).toHaveCount(3)

  await page.getByTestId('league-select').selectOption('tournament-1')
  await page.getByTestId('tournament-select').selectOption('2026-03-15')

  await page.getByTestId('nav-stats').click()
  await expect(page.getByRole('heading', { name: 'סטטיסטיקות כלל הטורנירים - שישי צהריים' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'דירוג שערים' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'דירוג בישולים' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'דירוג הגנתי' })).toBeVisible()
  // summaryOnly mode: full player table is hidden for tournament leagues
  await expect(page.locator('[data-testid^="player-stats-row-"]')).toHaveCount(0)

  await page.getByTestId('nav-live').click()
  await expect(page.getByTestId('tournament-select')).toBeVisible()
})

test('management controls are separated and empty tournament leagues can still start from scratch', async ({ page }) => {
  // Admin panel is on the admin tab — always accessible when logged in
  await page.getByTestId('nav-admin').click()
  await expect(page.getByTestId('management-panel')).toBeVisible()
  await expect(page.getByTestId('add-league-name')).toBeVisible()
  await expect(page.getByTestId('clear-league-data')).toBeEnabled()
  await expect(page.getByTestId('reset-league-to-mock')).toBeEnabled()

  // Back to live for tournament interaction
  await page.getByTestId('nav-live').click()
  await page.getByTestId('league-select').selectOption('tournament-2')
  await expect(page.getByText('אין טורניר זמין. ניתן ליצור טורניר חדש.')).toBeVisible()

  await page.getByTestId('create-tournament-empty').click()
  await expect(page.getByTestId('tournament-select')).toBeVisible()
  await addPlayer(page, 'שחקן ליגת שבת')
  await setTeamPlayer(page, 'team1', 'שחקן ליגת שבת')
  await expect(page.getByTestId('team-card-team1').getByText('שחקן ליגת שבת')).toBeVisible()

  await page.getByTestId('league-select').selectOption('tournament-1')
  const optionsBefore = await page.locator('[data-testid="tournament-select"] option').count()
  await page.getByTestId('create-tournament').click()
  await expect(page.locator('[data-testid="tournament-select"] option')).toHaveCount(optionsBefore + 1)
})

test('management actions clear the selected league and can restore its mock data after confirmation', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-1')

  // Navigate to live to verify initial state
  await expect(page.locator('[data-testid="tournament-select"] option')).toHaveCount(2)

  // Navigate to admin tab for management actions
  await page.getByTestId('nav-admin').click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId('clear-league-data').click()

  // Back to live to see effect
  await page.getByTestId('nav-live').click()
  await expect(page.getByText('אין טורניר זמין. ניתן ליצור טורניר חדש.')).toBeVisible()

  await page.getByTestId('nav-stats').click()
  await expect(page.locator('[data-testid^="player-stats-row-"]')).toHaveCount(0)

  // Admin tab to reset
  await page.getByTestId('nav-admin').click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId('reset-league-to-mock').click()

  // Back to live to verify restore
  await page.getByTestId('nav-live').click()
  await expect(page.locator('[data-testid="tournament-select"] option')).toHaveCount(2)

  await page.getByTestId('nav-stats').click()
  // summaryOnly mode hides the full table; verify stats section is present with content
  await expect(page.getByTestId('player-stats-summary')).toBeVisible()
  await expect(page.locator('[data-testid^="compact-goals-row-"]')).not.toHaveCount(0)
})

test('player and team changes persist after refresh and league switching', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await expect(page.getByText('אין טורניר זמין. ניתן ליצור טורניר חדש.')).toBeVisible()

  await page.getByTestId('create-tournament-empty').click()
  await addPlayer(page, 'שחקן התמדה')
  await setTeamPlayer(page, 'team1', 'שחקן התמדה')
  await page.getByTestId('team-color-select-team1').selectOption('white')
  await expect(page.getByTestId('team-card-team1')).toContainText('לבן')
  await expect(page.getByTestId('team-card-team1').getByText('שחקן התמדה')).toBeVisible()

  // Supabase persistence is async (debounced writes). Give it a moment before reload.
  // Sequential Supabase saves (leagues → players → tournaments) can take >1s after debounce.
  await page.waitForTimeout(2000)
  await page.reload()
  // League selection is not persisted across reload; re-select the league.
  await page.getByTestId('league-select').selectOption('tournament-2')
  // After reload the default mode is selecting — switch to drag to verify player assignments in team cards
  await switchToDragMode(page)
  await expect(page.getByTestId('team-card-team1')).toContainText('לבן')
  await expect(page.getByTestId('team-card-team1').getByText('שחקן התמדה')).toBeVisible()

  await page.getByTestId('league-select').selectOption('tournament-1')
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.reload()

  await page.getByTestId('league-select').selectOption('tournament-2')
  await switchToDragMode(page)
  await expect(page.getByTestId('team-card-team1')).toContainText('לבן')
  await expect(page.getByTestId('team-card-team1').getByText('שחקן התמדה')).toBeVisible()
})

test('saved tournament games persist after refresh and league switching', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await expect(page.getByText('אין טורניר זמין. ניתן ליצור טורניר חדש.')).toBeVisible()
  await page.getByTestId('create-tournament-empty').click()
  const tournamentId = await page.getByTestId('tournament-select').inputValue()

  await addPlayers(page, ['שחקן A', 'שחקן B', 'שחקן C', 'שחקן D', 'שחקן E', 'שחקן F'])
  await setTeamPlayer(page, 'team1', 'שחקן A')
  await setTeamPlayer(page, 'team1', 'שחקן B')
  await setTeamPlayer(page, 'team2', 'שחקן C')
  await setTeamPlayer(page, 'team2', 'שחקן D')
  await setTeamPlayer(page, 'team3', 'שחקן E')
  await setTeamPlayer(page, 'team3', 'שחקן F')

  await page.getByTestId('game-team-a-select').selectOption('team1')
  await page.getByTestId('game-team-b-select').selectOption('team2')
  await setScore(page, 'a', 1)
  await setScore(page, 'b', 0)
  await page.getByTestId('event-scorer-0').selectOption({ label: 'שחקן A' })
  await page.getByTestId('event-assister-0').selectOption({ label: 'שחקן B' })
  await page.getByTestId('save-game-button').click()
  await expect(page.getByText('שחור 1 – 0 צהוב')).toBeVisible()

  await page.waitForTimeout(2000)
  await page.reload()
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('tournament-select').selectOption(tournamentId)
  await expect(page.getByText('שחור 1 – 0 צהוב')).toBeVisible()

  await page.getByTestId('league-select').selectOption('tournament-1')
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.reload()

  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('tournament-select').selectOption(tournamentId)
  await expect(page.getByText('שחור 1 – 0 צהוב')).toBeVisible()
  await page.getByTestId('nav-stats').click()
  // summaryOnly mode — verify scorer appears in the compact goals table
  await expect(page.locator('[data-testid^="compact-goals-row-"]').filter({ hasText: 'שחקן A' })).toHaveCount(1)
})

test('team builder enforces unique players, max seven players, and team color changes for tournament leagues', async ({
  page,
}) => {
  await enableAdminMode(page)
  await addPlayers(page, ['תוספת 1', 'תוספת 2'])

  await switchToDragMode(page)
  await page.getByTestId('team-color-select-team1').selectOption('blue')
  await expect(page.getByTestId('team-card-team1')).toContainText('כחול')

  await setTeamPlayer(page, 'team1', 'תוספת 1')
  await expect(page.getByTestId('team-card-team1').getByText('תוספת 1')).toBeVisible()

  await setTeamPlayer(page, 'team1', 'תוספת 1', false)
  await expect(page.getByTestId('team-card-bench').getByText('תוספת 1')).toBeVisible()

  await setTeamPlayer(page, 'team1', 'רועי בן דוד')
  await expect(page.getByTestId('team-card-team1').getByText('רועי בן דוד')).toBeVisible()
  await expect(page.getByTestId('team-card-team2').getByText('רועי בן דוד')).toHaveCount(0)

  await setTeamPlayer(page, 'team1', 'תוספת 2')
  await expect(page.getByTestId('team-builder-message')).toContainText('אי אפשר להוסיף יותר מ-7 שחקנים לקבוצה.')
  await expect(page.getByTestId('team-card-team1').getByText('תוספת 2')).toHaveCount(0)
})

test('games, scoring events, standings, editing, deleting, undo, and stats updates work end to end', async ({
  page,
}) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await expect(page.getByText('אין טורניר זמין. ניתן ליצור טורניר חדש.')).toBeVisible()
  await page.getByTestId('create-tournament-empty').click()
  await expect(page.getByTestId('tournament-select')).toBeVisible()
  await addPlayers(page, ['שחקן 1', 'שחקן 2', 'שחקן 3', 'שחקן 4', 'שחקן 5', 'שחקן 6'])
  await setTeamPlayer(page, 'team1', 'שחקן 1')
  await setTeamPlayer(page, 'team1', 'שחקן 2')
  await setTeamPlayer(page, 'team2', 'שחקן 3')
  await setTeamPlayer(page, 'team2', 'שחקן 4')
  await setTeamPlayer(page, 'team3', 'שחקן 5')
  await setTeamPlayer(page, 'team3', 'שחקן 6')

  await page.getByTestId('game-team-a-select').selectOption('team1')
  await page.getByTestId('game-team-b-select').selectOption('team2')
  await setScore(page, 'a', 2)
  await setScore(page, 'b', 1)
  await page.getByTestId('event-scorer-0').selectOption({ label: 'שחקן 1' })
  await page.getByTestId('event-assister-0').selectOption({ label: 'שחקן 2' })
  await page.getByTestId('event-scorer-1').selectOption({ label: 'שחקן 1' })
  await page.getByTestId('event-scorer-2').selectOption({ label: 'שחקן 3' })
  await page.getByTestId('save-game-button').click()

  const standingsRows = page.locator('[data-testid="live-standings-table"] tbody tr')
  await expect(standingsRows.nth(0)).toContainText('שחור')
  await expect(standingsRows.nth(0)).toContainText('3')
  await expect(page.getByText('שחור 2 – 1 צהוב')).toBeVisible()

  await page.getByRole('button', { name: 'עריכה' }).first().click()
  await setScore(page, 'a', 3)
  await page.getByTestId('cancel-edit-game').click()
  await expect(page.getByText('שחור 2 – 1 צהוב')).toBeVisible()

  await page.getByTestId('game-team-a-select').selectOption('team3')
  await page.getByTestId('game-team-b-select').selectOption('team2')
  await setScore(page, 'a', 1)
  await setScore(page, 'b', 0)
  await page.getByTestId('event-scorer-0').selectOption({ label: 'שחקן 5' })
  await page.getByTestId('save-game-button').click()
  await expect(page.getByText('ורוד 1 – 0 צהוב')).toBeVisible()

  await page.getByTestId('undo-last-game').click()
  await expect(page.getByText('ורוד 1 – 0 צהוב')).toHaveCount(0)

  await page.getByRole('button', { name: 'עריכה' }).first().click()
  await setScore(page, 'a', 1)
  await setScore(page, 'b', 1)
  await page.getByTestId('event-scorer-0').selectOption({ label: 'שחקן 1' })
  await page.getByTestId('event-assister-0').selectOption({ label: 'שחקן 2' })
  await page.getByTestId('event-scorer-1').selectOption({ label: 'שחקן 3' })
  await page.getByTestId('save-game-button').click()
  const blackRowAfterEdit = page.locator('[data-testid="live-standings-table"] tbody tr').filter({ hasText: 'שחור' }).first()
  await expect(blackRowAfterEdit).toContainText('1')

  await page.getByTestId('nav-stats').click()
  await expect(page.getByRole('heading', { name: 'סטטיסטיקות כלל הטורנירים - שבת A' })).toBeVisible()
  // summaryOnly mode — verify scorers/assisters appear in compact ranked tables
  await expect(page.locator('[data-testid^="compact-goals-row-"]').filter({ hasText: 'שחקן 1' })).toHaveCount(1)
  await expect(page.locator('[data-testid^="compact-assists-row-"]').filter({ hasText: 'שחקן 2' })).toHaveCount(1)
  await expect(page.locator('[data-testid^="compact-goals-row-"]').filter({ hasText: 'שחקן 3' })).toHaveCount(1)

  await page.getByTestId('nav-live').click()
  await page.getByRole('button', { name: 'מחיקה' }).first().click()
  await expect(page.getByText('שחור 1 – 1 צהוב')).toHaveCount(0)
})

test('editing a seeded game result updates live standings, tournament games, and stats', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-3')
  await expect(page.getByTestId('tournament-select')).toBeVisible()
  await page.getByTestId('tournament-select').selectOption('2026-03-07-sb')

  await page.getByTestId('edit-game-sb1-g8').click()
  await setScore(page, 'a', 1)
  await setScore(page, 'b', 0)
  await page.getByTestId('event-scorer-0').selectOption({ label: 'יובל חן' })
  await page.getByTestId('event-assister-0').selectOption({ label: 'גל ישראל' })
  await page.getByTestId('save-game-button').click()

  await expect(page.locator('[data-testid^="game-row-"]')).toHaveCount(8)
  await expect(page.getByText('ורוד 1 – 0 צהוב')).toBeVisible()

  const pinkRow = page.locator('[data-testid="live-standings-table"] tbody tr').filter({ hasText: 'ורוד' }).first()
  await expect(pinkRow.locator('td').nth(1)).toHaveText('5')
  await expect(pinkRow.locator('td').nth(2)).toHaveText('1')

  await page.getByTestId('nav-stats').click()
  // summaryOnly mode — top scorer (יואב כהן) remains rank 1 after edit; edited player (יובל חן 4 goals)
  // is outside top-5 compact table so we verify via the standings that were already checked above
  await expect(page.locator('[data-testid="compact-goals-row-0"]')).toContainText('יואב כהן')
})

test('adding a new game to a seeded tournament updates live standings, games list, and stats', async ({
  page,
}) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-3')
  await expect(page.getByTestId('tournament-select')).toBeVisible()
  await page.getByTestId('tournament-select').selectOption('2026-03-07-sb')

  const existingGames = page.locator('[data-testid^="game-row-"]')
  const existingCount = await existingGames.count()
  const blackRow = page.locator('[data-testid="live-standings-table"] tbody tr').filter({ hasText: 'שחור' }).first()

  await page.getByTestId('game-team-a-select').selectOption('team1')
  await page.getByTestId('game-team-b-select').selectOption('team3')
  await setScore(page, 'a', 1)
  await setScore(page, 'b', 0)
  await page.getByTestId('event-scorer-0').selectOption({ label: 'יואב כהן' })
  await page.getByTestId('event-assister-0').selectOption({ label: 'אדם פרץ' })
  await page.getByTestId('save-game-button').click()

  await expect(existingGames).toHaveCount(existingCount + 1)
  await expect(page.getByText('שחור 1 – 0 ורוד')).toBeVisible()
  await expect(blackRow.locator('td').nth(1)).toHaveText('16')
  await expect(blackRow.locator('td').nth(2)).toHaveText('5')

  await page.getByTestId('nav-stats').click()
  // summaryOnly mode — top scorer (יואב כהן, now 9 goals) remains rank 1
  // אדם פרץ (4 assists) is outside top-5 assists; standings above already confirm the game was saved
  await expect(page.locator('[data-testid="compact-goals-row-0"]')).toContainText('יואב כהן')
})

test('regular league stats show a league table and summary leaders without the full player table', async ({ page }) => {
  await page.getByTestId('league-select').selectOption('regular-1')
  await expect(page.getByRole('heading', { name: 'ניהול מחזור ליגה' })).toBeVisible()
  await expect(page.getByTestId('tournament-select')).toBeVisible()
  // team-name-input only renders in drag mode
  await switchToDragMode(page)
  await expect(page.getByTestId('team-name-input-regular-team-1')).toBeVisible()
  await expect(page.getByTestId('team-name-input-regular-team-1')).toHaveValue('נשרים')

  await page.getByTestId('nav-stats').click()
  await expect(page.getByRole('heading', { name: 'טבלת ליגה וראשי קטגוריות - ליגת סוקרזון 5' })).toBeVisible()
  await expect(page.getByTestId('live-standings-table')).toBeVisible()
  await expect(page.getByTestId('live-standings-table').getByRole('cell', { name: 'נשרים' })).toBeVisible()
  await expect(page.getByTestId('live-standings-table').getByRole('cell', { name: 'זאבים' })).toBeVisible()
  await expect(page.locator('[data-testid^="player-stats-row-"]')).toHaveCount(0)
  await expect(page.getByTestId('player-stats-summary')).toContainText('דירוג שערים')
})

test('regular league roster editing can be enabled after round one', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('regular-1')
  await page.getByTestId('tournament-select').selectOption('regular-1-mw2')

  await expect(page.getByTestId('team-card-regular-team-1')).toContainText('נשרים')
  await expect(page.getByTestId('team-name-input-regular-team-1')).toHaveCount(0)
  await expect(page.getByTestId('regular-roster-edit-toggle')).not.toBeChecked()

  // Switch to drag mode — team name inputs and bench card only render there
  await switchToDragMode(page)
  await page.getByTestId('regular-roster-edit-toggle').check()
  await expect(page.getByTestId('team-name-input-regular-team-1')).toBeVisible()
  await expect(page.getByTestId('team-name-input-regular-team-1')).toBeEnabled()

  await page.getByTestId('team-name-input-regular-team-1').fill('נשרים מעודכנים')
  await expect(page.getByTestId('team-name-input-regular-team-1')).toHaveValue('נשרים מעודכנים')
  await setTeamPlayer(page, 'regular-team-1', 'עמית בן חיים', false)
  await expect(page.getByTestId('team-card-regular-team-1').getByText('עמית בן חיים')).toHaveCount(0)
  await expect(page.getByTestId('team-card-bench').getByText('עמית בן חיים')).toBeVisible()
})

test('friendlies live mode hides the standings table and keeps overall stats on the stats page', async ({ page }) => {
  await page.getByTestId('league-select').selectOption('friendly-1')
  await expect(page.getByRole('heading', { name: 'ניהול יום משחקים' })).toBeVisible()
  await expect(page.getByTestId('tournament-select')).toBeVisible()
  await expect(page.getByTestId('live-standings-table')).toHaveCount(0)
  await expect(page.locator('[data-testid^="game-row-"]')).toHaveCount(1)

  await page.getByTestId('nav-stats').click()
  await expect(page.getByRole('heading', { name: 'סטטיסטיקת ידידות - סטטיסטיקת ידידות' })).toBeVisible()
  await expect(page.getByTestId('player-stats-summary')).toContainText('דירוג שערים')
})

test('stats summary ranked tables show top player from seed data at rank 1', async ({ page }) => {
  await page.getByTestId('league-select').selectOption('tournament-3')
  await page.getByTestId('nav-stats').click()

  const summary = page.getByTestId('player-stats-summary')
  await expect(summary).toBeVisible()

  // Compact ranked tables always show (summaryOnly mode — full table is hidden)
  await expect(summary).toContainText('דירוג שערים')
  await expect(summary).toContainText('דירוג בישולים')
  await expect(page.locator('[data-testid^="player-stats-row-"]')).toHaveCount(0)

  // Top-ranked scorer in seed data for tournament-3 is יואב כהן
  const topScorerRow = page.locator('[data-testid="compact-goals-row-0"]')
  await expect(topScorerRow).toContainText('🥇')
  await expect(topScorerRow).toContainText('יואב כהן')

  // Top-ranked assister in seed data for tournament-3 is יואב כהן
  const topAssistRow = page.locator('[data-testid="compact-assists-row-0"]')
  await expect(topAssistRow).toContainText('🥇')
  await expect(topAssistRow).toContainText('יואב כהן')
})

test('bug-1: tournament teams should not be pre-filled to max capacity on creation', async ({ page }) => {
  await enableAdminMode(page)
  // Switch to an empty tournament league and create a new tournament
  await page.getByTestId('league-select').selectOption('tournament-2')
  await expect(page.getByText('אין טורניר זמין. ניתן ליצור טורניר חדש.')).toBeVisible()
  await page.getByTestId('create-tournament-empty').click()
  await expect(page.getByTestId('tournament-select')).toBeVisible()

  // Add 7 players
  for (let i = 1; i <= 7; i++) {
    await addPlayer(page, `שחקן ${i}`)
  }

  // Move all 7 to team1 - all should succeed (max is 7)
  for (let i = 1; i <= 7; i++) {
    await setTeamPlayer(page, 'team1', `שחקן ${i}`)
    await expect(page.getByTestId('team-builder-message')).toHaveCount(0)
  }
  await expect(page.getByTestId('team-card-team1').locator('[data-testid^="player-chip-"]')).toHaveCount(7)
})

test('bug-1b: adding player to one team does not reset assignments in other teams', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()

  await addPlayers(page, ['player A', 'player B'])
  await setTeamPlayer(page, 'team1', 'player A')
  await expect(page.getByTestId('team-card-team1').getByText('player A')).toBeVisible()

  await setTeamPlayer(page, 'team2', 'player B')
  // Player A must still be in team1 after adding player B to team2
  await expect(page.getByTestId('team-card-team1').getByText('player A')).toBeVisible()
  await expect(page.getByTestId('team-card-team2').getByText('player B')).toBeVisible()
})

test('bug-2: player can be deleted from bench but not from a team', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()

  await addPlayer(page, 'שחקן למחיקה')

  // Switch to drag mode — bench card (team-card-bench) only renders there
  await switchToDragMode(page)

  // Delete button should exist on bench player
  const benchChip = page.getByTestId('team-card-bench').locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן למחיקה' })
  await expect(benchChip.locator('[data-testid^="player-delete-"]')).toBeVisible()

  // Move player to team, delete button should disappear
  await setTeamPlayer(page, 'team1', 'שחקן למחיקה')
  const teamChip = page.getByTestId('team-card-team1').locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן למחיקה' })
  await expect(teamChip.locator('[data-testid^="player-delete-"]')).toHaveCount(0)

  // Move back to bench, delete, player should be gone
  await setTeamPlayer(page, 'team1', 'שחקן למחיקה', false)
  const benchChipAgain = page.getByTestId('team-card-bench').locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן למחיקה' })
  await benchChipAgain.locator('[data-testid^="player-delete-"]').click()
  await expect(page.getByText('שחקן למחיקה')).toHaveCount(0)
})

test('bug-3: offense and defense toggles update player roles', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()

  const saveAfterAdd = page
    .waitForResponse((resp) => resp.url().includes('/rest/v1/players') && resp.request().method() === 'POST' && resp.ok(), {
      timeout: 7000,
    })
    .catch(() => null)
  await addPlayer(page, 'שחקן תפקיד')
  await saveAfterAdd

  // Find the player chip and get the player id
  const chip = page.locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן תפקיד' }).first()
  const testId = await chip.getAttribute('data-testid')
  const playerId = testId.replace('player-chip-', '')

  const offenseBtn = page.getByTestId(`player-offense-${playerId}`)
  const defenseBtn = page.getByTestId(`player-defense-${playerId}`)

  // New players default to none (both off)
  await expect(offenseBtn).not.toHaveClass(/bg-emerald-100/)
  await expect(defenseBtn).not.toHaveClass(/bg-sky-100/)

  // Toggle offense ON, leave defense OFF
  const savePromise = page
    .waitForResponse((resp) => resp.url().includes('/rest/v1/players') && resp.request().method() === 'POST' && resp.ok(), {
      timeout: 7000,
    })
    .catch(() => null)
  await offenseBtn.click()
  await expect(offenseBtn).toHaveClass(/bg-emerald-100/)
  await expect(defenseBtn).not.toHaveClass(/bg-sky-100/)

  await savePromise
  // Toggle back off to ensure none-state is supported
  await offenseBtn.click()
  await expect(offenseBtn).not.toHaveClass(/bg-emerald-100/)
})

test('bug-3b: offense and defense can both be toggled off (none state)', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()

  await addPlayer(page, 'שחקן ניטרלי')

  const chip = page.locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן ניטרלי' }).first()
  const testId = await chip.getAttribute('data-testid')
  const playerId = testId.replace('player-chip-', '')

  const offenseBtn = page.getByTestId(`player-offense-${playerId}`)
  const defenseBtn = page.getByTestId(`player-defense-${playerId}`)

  // New player starts as none
  await expect(offenseBtn).not.toHaveClass(/bg-emerald-100/)
  await expect(defenseBtn).not.toHaveClass(/bg-sky-100/)

  // Turn on offense, then turn it off again - should go back to none
  await offenseBtn.click()
  await expect(offenseBtn).toHaveClass(/bg-emerald-100/)
  await offenseBtn.click()
  await expect(offenseBtn).not.toHaveClass(/bg-emerald-100/)
  await expect(defenseBtn).not.toHaveClass(/bg-sky-100/)
})

test('bug-4b: צור מחזור works first click after clearing regular league data', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('regular-1')

  // Navigate to admin tab to clear league data
  await page.getByTestId('nav-admin').click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId('clear-league-data').click()

  // Back to live to see effect
  await page.getByTestId('nav-live').click()
  await expect(page.getByText('אין מחזור זמין. ניתן ליצור מחזור חדש.')).toBeVisible()

  // Create tournament should work on the first click
  await page.getByTestId('create-tournament-empty').click()
  await expect(page.getByTestId('tournament-select')).toBeVisible()
})

test('player count indicator shows current and max players per team', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()

  await addPlayers(page, ['שחקן א', 'שחקן ב', 'שחקן ג'])
  await setTeamPlayer(page, 'team1', 'שחקן א')
  await setTeamPlayer(page, 'team1', 'שחקן ב')

  // team1 should show 2/7 (tournament max is 7)
  await expect(page.getByTestId('team-player-count-team1')).toBeVisible()
  await expect(page.getByTestId('team-player-count-team1')).toContainText('2/7')

  // After moving a player to fill the team
  await setTeamPlayer(page, 'team1', 'שחקן ג')
  await expect(page.getByTestId('team-player-count-team1')).toContainText('3/7')
})

test('bug-4: צור מחזור creates a new round on first click for regular league', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('regular-1')

  const countBefore = await page.locator('[data-testid="tournament-select"] option').count()
  await page.getByTestId('create-tournament').click()

  // Should immediately show +1 option
  await expect(page.locator('[data-testid="tournament-select"] option')).toHaveCount(countBefore + 1)

  // After reload, the new tournament should still be there
  await page.waitForTimeout(2000)
  await page.reload()
  await page.getByTestId('league-select').selectOption('regular-1')
  await expect(page.locator('[data-testid="tournament-select"] option')).toHaveCount(countBefore + 1)
})

test('admin panel is accessible when logged in and controls are visible', async ({ page }) => {
  await page.getByTestId('nav-admin').click()
  await expect(page.getByTestId('management-panel')).toBeVisible()
  await expect(page.getByTestId('clear-league-data')).toBeVisible()
  await expect(page.getByTestId('add-league-name')).toBeVisible()

  // Admin controls persist across reload (coach session in localStorage)
  await page.reload()
  await page.getByTestId('nav-admin').click()
  await expect(page.getByTestId('clear-league-data')).toBeVisible()
})

test('share copy button copies the correct day message to clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  await page.getByTestId('league-select').selectOption('tournament-3')
  await page.getByTestId('tournament-select').selectOption('2026-03-07-sb')

  // Share buttons appear only when games exist
  await expect(page.locator('[data-testid^="game-row-"]')).not.toHaveCount(0)
  await expect(page.getByTestId('share-copy-day')).toBeVisible()

  await page.getByTestId('share-copy-day').click()
  // Button shows ✓ feedback
  await expect(page.getByTestId('share-copy-day')).toContainText('✓')

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  // Message includes league name and date
  expect(clipboardText).toContain('שבת B')
  expect(clipboardText).toContain('2026-03-07')
  // Tournament mode: no individual game results, but scorers section present
  expect(clipboardText).toContain('כובשים')
})

test('share copy button copies the combined message to clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  await page.getByTestId('league-select').selectOption('tournament-3')
  await page.getByTestId('tournament-select').selectOption('2026-03-07-sb')

  await expect(page.getByTestId('share-copy-combined')).toBeVisible()
  await page.getByTestId('share-copy-combined').click()

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  // Combined message has the separator between day and overall sections
  expect(clipboardText).toContain('שבת B')
  expect(clipboardText).toContain('───────────────')
  // Overall section heading
  expect(clipboardText).toContain('סיכום כללי')
  // Share messages must NOT contain URL params (PR #11 removed deep links from share)
  expect(clipboardText).not.toContain('league=tournament-3')
  expect(clipboardText).not.toContain('tournament=2026-03-07-sb')
})

test('team share copies assigned squads and deep links to the selected league and tournament', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  await page.goto('/?league=tournament-3&tournament=2026-03-07-sb')
  await page.getByRole('button', { name: /יאללה נשחק/ }).click({ timeout: 2000 }).catch(() => {})

  await expect(page.getByTestId('league-select')).toHaveValue('tournament-3')
  await expect(page.getByTestId('tournament-select')).toHaveValue('2026-03-07-sb')
  await expect(page.getByTestId('share-copy-teams')).toBeVisible()

  await page.getByTestId('share-copy-teams').click()

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText).toContain('שבת B')
  expect(clipboardText).toContain('שחור')
  expect(clipboardText).toContain('יואב כהן')
  // Share messages must NOT contain URL params (PR #11 removed deep links from share)
  expect(clipboardText).not.toContain('league=tournament-3')
  expect(clipboardText).not.toContain('tournament=2026-03-07-sb')
})

// TODO: flaky — pressing Enter on tournament-name-input occasionally triggers a page navigation
// (the input sits inside a form-like context), which closes the page mid-test before
// tournament-number-input can be reached. Needs investigation into the form/submit handler.
test.skip('admin can edit player names and session metadata', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('regular-1')

  // Rename player
  await page.getByTestId('player-name-input-regular-p1').fill('נועם המעודכן')

  // Edit session name via pencil toggle
  await page.getByTestId('tournament-name-edit-pencil').click()
  await page.getByTestId('tournament-name-input').fill('מחזור פתיחה מעודכן')
  await page.getByTestId('tournament-name-input').press('Enter')

  // Edit number and date (still in the admin grid)
  await page.getByTestId('tournament-number-input').fill('11')
  await page.getByTestId('tournament-date-input').fill('2026-04-01')

  await expect(page.getByTestId('player-name-input-regular-p1')).toHaveValue('נועם המעודכן')
  await expect(page.getByTestId('tournament-select')).toContainText('מחזור פתיחה מעודכן')

  await page.waitForTimeout(2000)
  await page.reload()

  await expect(page.getByTestId('league-select')).toHaveValue('regular-1')
  await expect(page.getByTestId('player-name-input-regular-p1')).toHaveValue('נועם המעודכן')

  // Name is shown in display mode — open pencil to verify persisted value
  await page.getByTestId('tournament-name-edit-pencil').click()
  await expect(page.getByTestId('tournament-name-input')).toHaveValue('מחזור פתיחה מעודכן')
  await page.getByTestId('tournament-name-input').press('Escape')

  await expect(page.getByTestId('tournament-number-input')).toHaveValue('11')
  await expect(page.getByTestId('tournament-date-input')).toHaveValue('2026-04-01')
})

test('regular league combined share includes all teams in standings', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('regular-1')

  // Add team 5 via form
  await page.getByTestId('add-regular-team').click()
  await page.getByTestId('add-team-name-input').fill('קבוצה 5')
  await page.getByTestId('add-team-confirm').click()
  // Add team 6 via form
  await page.getByTestId('add-regular-team').click()
  await page.getByTestId('add-team-name-input').fill('קבוצה 6')
  await page.getByTestId('add-team-confirm').click()
  // team-name-input only renders in drag mode
  await switchToDragMode(page)
  await expect(page.locator('input[value="קבוצה 5"]')).toBeVisible()
  await expect(page.locator('input[value="קבוצה 6"]')).toBeVisible()

  await expect(page.getByTestId('share-copy-combined')).toBeVisible()
  await page.getByTestId('share-copy-combined').click()

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText).toContain('ליגת סוקרזון 5')
  expect(clipboardText).toContain('📊 טבלת ניקוד:')
  expect(clipboardText).toContain('קבוצה 5')
  expect(clipboardText).toContain('קבוצה 6')
})

// ─── Notification panel ───────────────────────────────────────────────────────

test('admin notification panel: templates render and message fills textarea', async ({ page }) => {
  await page.reload()
  await page.getByRole('button', { name: /יאללה נשחק/ }).click({ timeout: 2000 }).catch(() => {})

  await page.getByTestId('nav-admin').click()

  // All template buttons visible
  await expect(page.getByTestId('notif-template-morning')).toBeVisible()
  await expect(page.getByTestId('notif-template-squads')).toBeVisible()
  await expect(page.getByTestId('notif-template-custom')).toBeVisible()

  // Select morning template — textarea should fill
  await page.getByTestId('notif-template-morning').click()
  const textarea = page.getByTestId('notif-message-textarea')
  await expect(textarea).toBeVisible()
  await expect(textarea).toHaveValue(/תזכורת/)

  // WhatsApp send button visible
  await expect(page.getByTestId('notif-send-whatsapp')).toBeVisible()

  // Scheduler toggle not present (reminders disabled)
  await expect(page.getByTestId('notif-schedule-toggle')).toHaveCount(0)
})

// ─── PR #9: delete league ─────────────────────────────────────────────────────

test('delete league removes it from the league dropdown', async ({ page }) => {
  await enableAdminMode(page)

  // Count leagues before
  const optionsBefore = await page.locator('[data-testid="league-select"] option').count()

  // Create a new league so we can safely delete it without touching seed data
  await page.getByTestId('nav-admin').click()
  await page.getByTestId('add-league-name').fill('ליגת מחיקה')
  await page.getByTestId('add-league-save').click()
  await expect(page.locator('[data-testid="league-select"] option')).toHaveCount(optionsBefore + 1)

  // Delete it
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId('delete-league').click()
  await expect(page.locator('[data-testid="league-select"] option')).toHaveCount(optionsBefore)
})

// ─── PR #10: rank, clean-teams, auto-generate ─────────────────────────────────

test('player rank dropdown shows A/B/C options and persists changes', async ({ page }) => {
  // Rank select is always visible for logged-in users
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()
  await addPlayer(page, 'שחקן דירוג')

  const rankChip = page.locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן דירוג' }).first()
  const rankId = (await rankChip.getAttribute('data-testid')).replace('player-chip-', '')
  const rankSelect = page.getByTestId(`player-rank-${rankId}`)

  // Default rank is B
  await expect(rankSelect).toHaveValue('B')
  // Select A directly
  await rankSelect.selectOption('A')
  await expect(rankSelect).toHaveValue('A')
  // Select C directly
  await rankSelect.selectOption('C')
  await expect(rankSelect).toHaveValue('C')
  // Select B directly
  await rankSelect.selectOption('B')
  await expect(rankSelect).toHaveValue('B')
})

test('clean teams button returns all players to bench', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()

  await addPlayers(page, ['שחקן נקה 1', 'שחקן נקה 2', 'שחקן נקה 3'])
  await setTeamPlayer(page, 'team1', 'שחקן נקה 1')
  await setTeamPlayer(page, 'team2', 'שחקן נקה 2')
  await expect(page.getByTestId('team-card-team1').getByText('שחקן נקה 1')).toBeVisible()
  await expect(page.getByTestId('team-card-team2').getByText('שחקן נקה 2')).toBeVisible()

  await page.getByTestId('clean-teams-button').click()

  // All players should be back on bench
  await expect(page.getByTestId('team-card-bench').getByText('שחקן נקה 1')).toBeVisible()
  await expect(page.getByTestId('team-card-bench').getByText('שחקן נקה 2')).toBeVisible()
  await expect(page.getByTestId('team-card-bench').getByText('שחקן נקה 3')).toBeVisible()
  // Teams should be empty
  await expect(page.getByTestId('team-card-team1').locator('[data-testid^="player-chip-"]')).toHaveCount(0)
  await expect(page.getByTestId('team-card-team2').locator('[data-testid^="player-chip-"]')).toHaveCount(0)
})

test('auto-generate distributes bench players across teams', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()

  await addPlayers(page, ['שחקן אוטו 1', 'שחקן אוטו 2', 'שחקן אוטו 3', 'שחקן אוטו 4', 'שחקן אוטו 5', 'שחקן אוטו 6'])

  // Switch to drag mode — auto-generate there saves immediately and bench card exists
  await switchToDragMode(page)

  // All players on bench before auto-generate
  await expect(page.getByTestId('team-card-bench').locator('[data-testid^="player-chip-"]')).toHaveCount(6)

  await page.getByTestId('auto-generate-teams-button').click()

  // After auto-generate bench should be empty and teams should have players
  await expect(page.getByTestId('team-card-bench').locator('[data-testid^="player-chip-"]')).toHaveCount(0)
  const team1Count = await page.getByTestId('team-card-team1').locator('[data-testid^="player-chip-"]').count()
  const team2Count = await page.getByTestId('team-card-team2').locator('[data-testid^="player-chip-"]').count()
  const team3Count = await page.getByTestId('team-card-team3').locator('[data-testid^="player-chip-"]').count()
  expect(team1Count + team2Count + team3Count).toBe(6)
})

// ─── PR #10: role buttons admin-only ──────────────────────────────────────────

test('offense and defense role buttons are visible for logged-in users', async ({ page }) => {
  await page.getByTestId('league-select').selectOption('tournament-1')
  await page.getByTestId('tournament-select').selectOption('2026-03-01')

  const anyChip = page.locator('[data-testid^="player-chip-"]').first()
  await expect(anyChip).toBeVisible()
  const chipId = (await anyChip.getAttribute('data-testid')).replace('player-chip-', '')

  await expect(page.getByTestId(`player-offense-${chipId}`)).toBeVisible()
  await expect(page.getByTestId(`player-defense-${chipId}`)).toBeVisible()
})

// ─── PR #11: friendly 2 teams, add/remove, max 11 ────────────────────────────

test('new friendly session starts with 2 teams and allows adding/removing teams', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('friendly-1')

  // Create a new session in the friendly league
  const countBefore = await page.locator('[data-testid="tournament-select"] option').count()
  await page.getByTestId('create-tournament').click()
  await expect(page.locator('[data-testid="tournament-select"] option')).toHaveCount(countBefore + 1)

  // New session should have exactly 2 team cards (not 3) — exclude bench
  const teamCards = () => page.locator('[data-testid^="team-card-"]:not([data-testid="team-card-bench"])')
  await expect(teamCards()).toHaveCount(2)

  // Add a third team via the form (pick blue then confirm)
  await page.getByTestId('add-friendly-team').click()
  await expect(page.getByTestId('add-team-form')).toBeVisible()
  await page.getByTestId('add-team-color-swatch-blue').click()
  await page.getByTestId('add-team-confirm').click()
  await expect(teamCards()).toHaveCount(3)

  // Remove the third team — remove buttons in drag mode
  await switchToDragMode(page)
  const removeButtons = page.locator('[data-testid^="remove-team-"]')
  await expect(removeButtons).toHaveCount(3)
  await removeButtons.last().click()
  await expect(teamCards()).toHaveCount(2)

  // Remove buttons still show at 2 teams, but clicking one shows the min-teams error
  await removeButtons.first().click()
  await expect(page.getByTestId('team-builder-message')).toContainText('2')
})

test('friendly team allows up to 11 players and rejects a 12th', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('friendly-1')
  await page.getByTestId('create-tournament').click()

  // Add 11 players
  for (let i = 1; i <= 11; i++) {
    await addPlayer(page, `שחקן ידידות ${i}`)
  }
  for (let i = 1; i <= 11; i++) {
    await setTeamPlayer(page, 'team1', `שחקן ידידות ${i}`)
    await expect(page.getByTestId('team-builder-message')).toHaveCount(0)
  }
  await expect(page.getByTestId('team-player-count-team1')).toContainText('11/11')

  // 12th player should trigger max-capacity message
  await addPlayer(page, 'שחקן ידידות 12')
  await setTeamPlayer(page, 'team1', 'שחקן ידידות 12')
  await expect(page.getByTestId('team-builder-message')).toBeVisible()
})

// ─── PR #11: tournament session starts with 3 teams ──────────────────────────

test('new tournament session starts with 3 teams', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()

  await expect(page.getByTestId('team-card-team1')).toBeVisible()
  await expect(page.getByTestId('team-card-team2')).toBeVisible()
  await expect(page.getByTestId('team-card-team3')).toBeVisible()
})

// ─── PR #11: tournament date picker ──────────────────────────────────────────

test('tournament date can be changed via date picker and persists after reload', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()
  const tournamentId = await page.getByTestId('tournament-select').inputValue()

  // Change the date
  await page.getByTestId('tournament-date-input').fill('2026-06-15')
  await expect(page.getByTestId('tournament-date-input')).toHaveValue('2026-06-15')

  // Persist and reload
  await page.waitForTimeout(2000)
  await page.reload()
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('tournament-select').selectOption(tournamentId)
  await expect(page.getByTestId('tournament-date-input')).toHaveValue('2026-06-15')
})

// ─── PR #11: active league persists across reload ────────────────────────────

test('active league selection persists in localStorage across page reload', async ({ page }) => {
  await page.getByTestId('league-select').selectOption('tournament-3')
  await expect(page.getByTestId('league-select')).toHaveValue('tournament-3')

  await page.waitForTimeout(500)
  await page.reload()
  await page.getByRole('button', { name: /יאללה נשחק/ }).click({ timeout: 2000 }).catch(() => {})

  // The previously selected league should be restored from localStorage
  await expect(page.getByTestId('league-select')).toHaveValue('tournament-3')
})

// ─── PR #11: live score survives page refresh ─────────────────────────────────

test('in-progress live score is restored from sessionStorage after page refresh', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-3')
  await page.getByTestId('tournament-select').selectOption('2026-03-07-sb')

  // Select teams and enter a score without saving
  await page.getByTestId('game-team-a-select').selectOption('team1')
  await page.getByTestId('game-team-b-select').selectOption('team3')
  await setScore(page, 'a', 2)
  await setScore(page, 'b', 1)

  // Reload without saving
  await page.reload()
  await page.getByRole('button', { name: /יאללה נשחק/ }).click({ timeout: 2000 }).catch(() => {})

  // Score should be restored
  await expect(page.getByTestId('score-a-input')).toHaveText('2')
  await expect(page.getByTestId('score-b-input')).toHaveText('1')

  // Selected teams should also be restored
  await expect(page.getByTestId('game-team-a-select')).toHaveValue('team1')
  await expect(page.getByTestId('game-team-b-select')).toHaveValue('team3')
})

// ─── PR #11: share messages contain no URLs ───────────────────────────────────

test('share messages do not contain URL parameters', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  await page.getByTestId('league-select').selectOption('tournament-3')
  await page.getByTestId('tournament-select').selectOption('2026-03-07-sb')

  // Day share
  await page.getByTestId('share-copy-day').click()
  const dayText = await page.evaluate(() => navigator.clipboard.readText())
  expect(dayText).not.toContain('league=')
  expect(dayText).not.toContain('tournament=')
  expect(dayText).not.toContain('http')

  // Teams share
  await page.getByTestId('share-copy-teams').click()
  const teamsText = await page.evaluate(() => navigator.clipboard.readText())
  expect(teamsText).not.toContain('league=')
  expect(teamsText).not.toContain('tournament=')
  expect(teamsText).not.toContain('http')
})

// ─── Selecting mode ───────────────────────────────────────────────────────────

test('selecting mode is the default, team dropdown assigns players, save persists, drag mode preserves old behaviour', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()
  await addPlayers(page, ['שחקן 1', 'שחקן 2', 'שחקן 3', 'שחקן 4', 'שחקן 5', 'שחקן 6'])

  // Default mode is selecting — toggle visible, "בחירה" button is active
  await expect(page.getByTestId('mode-toggle-selecting')).toBeVisible()
  await expect(page.getByTestId('mode-toggle-dragging')).toBeVisible()
  await expect(page.getByTestId('mode-toggle-selecting')).toHaveClass(/bg-blue-600/)
  await expect(page.getByTestId('mode-toggle-dragging')).not.toHaveClass(/bg-blue-600/)

  // Flat player list visible in selecting mode
  await expect(page.locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן 1' })).toBeVisible()

  // Initial state: all players on bench — team dropdowns show empty value
  const teamSelect1 = page.locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן 1' }).locator('[data-testid^="player-team-cycle-"]')
  await expect(teamSelect1).toHaveValue('')

  // Select team1 from dropdown
  await teamSelect1.selectOption('team1')
  await expect(teamSelect1).not.toHaveValue('')

  // Team1 count in summary card updates live
  await expect(page.getByTestId('team-player-count-team1')).toContainText('1')

  // Save button highlights with ring when there are unsaved changes
  await expect(page.getByTestId('selecting-mode-save')).toHaveClass(/ring-2/)

  // Saving persists the assignment
  await page.getByTestId('selecting-mode-save').click()
  await expect(page.getByTestId('selecting-mode-save')).not.toHaveClass(/ring-2/)

  // Verify in drag mode that שחקן 1 landed in team1
  await page.getByTestId('mode-toggle-dragging').click()
  await expect(page.getByTestId('team-card-team1').getByText('שחקן 1')).toBeVisible()

  // Switching back to selecting resets pending to the saved state
  await page.getByTestId('mode-toggle-selecting').click()
  const teamSelectAgain = page.locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן 1' }).locator('[data-testid^="player-team-cycle-"]')
  await expect(teamSelectAgain).not.toHaveValue('')
})

test('selecting mode auto-generate distributes players locally without saving, clean resets to bench locally', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()
  await addPlayers(page, ['שחקן 1', 'שחקן 2', 'שחקן 3', 'שחקן 4', 'שחקן 5', 'שחקן 6'])

  // Auto-generate: distributes all 6 players across 3 teams (2 each)
  await page.getByTestId('auto-generate-teams-button').click()

  // All team dropdowns should have non-empty values — all players assigned
  const allTeamSelects = page.locator('[data-testid^="player-team-cycle-"]')
  const selectCount = await allTeamSelects.count()
  for (let i = 0; i < selectCount; i++) {
    await expect(allTeamSelects.nth(i)).not.toHaveValue('')
  }

  // Save button highlighted after auto-generate (pending change)
  await expect(page.getByTestId('selecting-mode-save')).toHaveClass(/ring-2/)

  // Save persists the auto-generated assignments
  await page.getByTestId('selecting-mode-save').click()
  await expect(page.getByTestId('selecting-mode-save')).not.toHaveClass(/ring-2/)

  // Drag mode confirms the assignments were saved
  await page.getByTestId('mode-toggle-dragging').click()
  const team1Players = page.getByTestId('team-card-team1').locator('[data-testid^="player-chip-"]')
  await expect(team1Players).not.toHaveCount(0)

  // Back to selecting, clean puts everyone back to bench locally
  await page.getByTestId('mode-toggle-selecting').click()
  await page.getByTestId('clean-teams-button').click()
  const afterCleanSelects = page.locator('[data-testid^="player-team-cycle-"]')
  const afterCleanCount = await afterCleanSelects.count()
  for (let i = 0; i < afterCleanCount; i++) {
    await expect(afterCleanSelects.nth(i)).toHaveValue('')
  }
  await expect(page.getByTestId('selecting-mode-save')).toHaveClass(/ring-2/)
})

// ─── 1.0.13: colors, top save, dropdowns, team add/remove ─────────────────────

test('all allowed team colors appear in the color picker including red', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-1')
  await page.getByTestId('tournament-select').selectOption('2026-03-01')
  await switchToDragMode(page)

  const colorSelect = page.getByTestId('team-color-select-team1')
  for (const color of ['black', 'yellow', 'pink', 'orange', 'blue', 'red', 'gray', 'white']) {
    await expect(colorSelect.locator(`option[value="${color}"]`)).toHaveCount(1)
  }

  // Red is selectable and updates the team card label
  await colorSelect.selectOption('red')
  await expect(page.getByTestId('team-card-team1')).toContainText('אדום')

  // Blue works too
  await colorSelect.selectOption('blue')
  await expect(page.getByTestId('team-card-team1')).toContainText('כחול')

  // Orange
  await colorSelect.selectOption('orange')
  await expect(page.getByTestId('team-card-team1')).toContainText('כתום')

  // White
  await colorSelect.selectOption('white')
  await expect(page.getByTestId('team-card-team1')).toContainText('לבן')
})

test('top save button exists, is disabled when no changes, enabled when dirty, and saves on click', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()
  await addPlayer(page, 'שחקן שמירה')

  // Top save button exists and is disabled initially (no pending changes)
  await expect(page.getByTestId('selecting-mode-save-top')).toBeVisible()
  await expect(page.getByTestId('selecting-mode-save-top')).toBeDisabled()
  await expect(page.getByTestId('selecting-mode-save')).toBeDisabled()

  // Make a change — assign player to team1
  const teamSelect = page.locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן שמירה' }).locator('[data-testid^="player-team-cycle-"]')
  await teamSelect.selectOption('team1')

  // Both save buttons now enabled and highlighted
  await expect(page.getByTestId('selecting-mode-save-top')).not.toBeDisabled()
  await expect(page.getByTestId('selecting-mode-save-top')).toHaveClass(/ring-2/)
  await expect(page.getByTestId('selecting-mode-save')).not.toBeDisabled()
  await expect(page.getByTestId('selecting-mode-save')).toHaveClass(/ring-2/)

  // Click top save button — both buttons go back to disabled
  await page.getByTestId('selecting-mode-save-top').click()
  await expect(page.getByTestId('selecting-mode-save-top')).toBeDisabled()
  await expect(page.getByTestId('selecting-mode-save')).toBeDisabled()

  // Assignment was saved — drag mode shows player in team1
  await page.getByTestId('mode-toggle-dragging').click()
  await expect(page.getByTestId('team-card-team1').getByText('שחקן שמירה')).toBeVisible()
})

test('tournament league allows adding and removing teams — minimum 2, maximum 8', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()

  const teamCards = () =>
    page.locator('[data-testid^="team-card-"]:not([data-testid="team-card-bench"])')

  // Starts with 3 teams (tournament default)
  await expect(teamCards()).toHaveCount(3)

  // Add a 4th team via the color form (pick red then confirm)
  await page.getByTestId('add-tournament-team').click()
  await expect(page.getByTestId('add-team-form')).toBeVisible()
  await page.getByTestId('add-team-color-swatch-red').click()
  await page.getByTestId('add-team-confirm').click()
  await expect(teamCards()).toHaveCount(4)

  // Cancel button dismisses the form without adding
  await page.getByTestId('add-tournament-team').click()
  await expect(page.getByTestId('add-team-form')).toBeVisible()
  await page.getByTestId('add-team-cancel').click()
  await expect(page.getByTestId('add-team-form')).toHaveCount(0)
  await expect(teamCards()).toHaveCount(4)

  // Remove buttons appear in selecting mode — at 4 teams all are enabled
  const removeButtons = page.locator('[data-testid^="remove-team-"]')
  await expect(removeButtons).not.toHaveCount(0)
  await expect(removeButtons.first()).not.toBeDisabled()

  // Add a 5th, then remove back to 2
  await page.getByTestId('add-tournament-team').click()
  await page.getByTestId('add-team-confirm').click()
  await switchToDragMode(page)
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-testid^="remove-team-"]').last().click()
  }
  await expect(teamCards()).toHaveCount(2)

  // At minimum — remove shows error message
  await switchToDragMode(page)
  await page.locator('[data-testid^="remove-team-"]').first().click()
  await expect(page.getByTestId('team-builder-message')).toContainText('2')
})

test('regular league shows info button when locked and hides it on first session', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('regular-1')

  // First session (leagueNumber 1) is editable — no info button
  await page.getByTestId('tournament-select').selectOption('regular-1-mw1')
  await expect(page.getByTestId('teams-locked-info')).toHaveCount(0)
  await expect(page.getByTestId('add-regular-team')).not.toBeDisabled()

  // Second session (leagueNumber 2) is locked — info button appears
  await page.getByTestId('tournament-select').selectOption('regular-1-mw2')
  await expect(page.getByTestId('teams-locked-info')).toBeVisible()
  await expect(page.getByTestId('add-regular-team')).toBeDisabled()
})

test('adding a team shows color picker form; regular league shows name input too; color is always editable after creation', async ({ page }) => {
  await enableAdminMode(page)

  // ── Tournament: color-only form ──
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()

  await page.getByTestId('add-tournament-team').click()
  await expect(page.getByTestId('add-team-form')).toBeVisible()
  // Name input should NOT appear for tournament
  await expect(page.getByTestId('add-team-name-input')).toHaveCount(0)
  // All allowed colors have swatches
  for (const color of ['black', 'yellow', 'pink', 'orange', 'blue', 'red', 'gray', 'white']) {
    await expect(page.getByTestId(`add-team-color-swatch-${color}`)).toBeVisible()
  }
  // Pick orange, confirm — team gets that color
  await page.getByTestId('add-team-color-swatch-orange').click()
  await page.getByTestId('add-team-confirm').click()
  await expect(page.getByTestId('add-team-form')).toHaveCount(0)
  // New team should reflect orange color — find the last color select (the 4th team)
  await switchToDragMode(page)
  const allColorSelects = page.locator('[data-testid^="team-color-select-"]')
  await expect(allColorSelects).toHaveCount(4)
  const newTeamSelect = allColorSelects.last()
  await expect(newTeamSelect).toHaveValue('orange')

  // Color can always be changed after creation
  await newTeamSelect.selectOption('red')
  await expect(newTeamSelect).toHaveValue('red')

  // ── Regular league: name + color form ──
  await page.getByTestId('league-select').selectOption('regular-1')
  await page.getByTestId('tournament-select').selectOption('regular-1-mw1')

  await page.getByTestId('add-regular-team').click()
  await expect(page.getByTestId('add-team-form')).toBeVisible()
  // Name input IS present for regular league
  await expect(page.getByTestId('add-team-name-input')).toBeVisible()
  // Confirm is disabled until name is filled
  await expect(page.getByTestId('add-team-confirm')).toBeDisabled()
  await page.getByTestId('add-team-name-input').fill('קבוצת הזהב')
  await expect(page.getByTestId('add-team-confirm')).not.toBeDisabled()
  // Pick blue color
  await page.getByTestId('add-team-color-swatch-blue').click()
  await page.getByTestId('add-team-confirm').click()
  await expect(page.getByTestId('add-team-form')).toHaveCount(0)

  // Color picker visible on the new team (always editable)
  await switchToDragMode(page)
  const newTeamCards = page.locator('[data-testid^="team-color-select-"]')
  const count = await newTeamCards.count()
  // There should be a color select for the new team with value 'blue'
  let foundBlue = false
  for (let i = 0; i < count; i++) {
    const val = await newTeamCards.nth(i).inputValue()
    if (val === 'blue') { foundBlue = true; break }
  }
  expect(foundBlue).toBeTruthy()
})

// ─── Generate Image Modal ──────────────────────────────────────────────────

const MOCK_GEMINI_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const navigateToStatsAndOpenModal = async (page) => {
  await page.getByTestId('league-select').selectOption('tournament-3')
  await page.getByTestId('nav-stats').click()
  await page.getByTestId('generate-image-btn-stats').click()
  await expect(page.getByTestId('generate-image-modal')).toBeVisible()
}

const mockGeminiSuccess = (page) =>
  page.route('**/generativelanguage.googleapis.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: MOCK_GEMINI_PNG } }] } }],
      }),
    }),
  )

const mockGeminiError = (page, message = 'API_KEY_INVALID') =>
  page.route('**/generativelanguage.googleapis.com/**', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message } }),
    }),
  )

// Image generation tests are gated by RUN_IMAGE_TESTS=true.
// Set in .env.local for local runs; CI sets it only on push to main (not PRs).
test.describe('Generate Image Modal', () => {
  test.beforeEach(() => {
    test.skip(!process.env.RUN_IMAGE_TESTS, 'Image generation — run locally or on main push only (set RUN_IMAGE_TESTS=true)')
  })

  test('stats page — option selection, loading, result, back, close', async ({ page }) => {
    await mockGeminiSuccess(page)
    await navigateToStatsAndOpenModal(page)

    // Stats page shows stats-table as 3rd option (not day-results)
    await expect(page.getByTestId('generate-option-stats-table')).toBeVisible()

    // Generate button disabled until an option is selected
    await expect(page.getByTestId('generate-submit')).toBeDisabled()
    await page.getByTestId('generate-option-mvp').click()
    await expect(page.getByTestId('generate-submit')).toBeEnabled()

    // Generate — spinner then result image
    await page.getByTestId('generate-submit').click()
    await expect(page.getByTestId('generate-loading')).toBeVisible()
    await expect(page.getByTestId('generate-result-image')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('generate-download')).toBeVisible()

    // Back returns to option picker
    await page.getByTestId('generate-back').click()
    await expect(page.getByTestId('generate-option-mvp')).toBeVisible()

    // Close dismisses modal
    await page.getByTestId('generate-image-close').click()
    await expect(page.getByTestId('generate-image-modal')).toHaveCount(0)
  })

  test('live mode — shows day-results option, generates image', async ({ page }) => {
    await mockGeminiSuccess(page)

    // Navigate to a tournament with games so the generate button appears
    await page.getByTestId('league-select').selectOption('tournament-3')
    // generate button only appears once there are games
    await page.getByTestId('generate-image-btn-live').click()
    await expect(page.getByTestId('generate-image-modal')).toBeVisible()

    // Live mode shows "תוצאות היום" as 3rd option, not "טבלת סטטיסטיקות"
    await expect(page.getByTestId('generate-option-day-results')).toBeVisible()
    await expect(page.getByTestId('generate-option-stats-table')).toHaveCount(0)

    // Generate the day-results image
    await page.getByTestId('generate-option-day-results').click()
    await page.getByTestId('generate-submit').click()
    await expect(page.getByTestId('generate-result-image')).toBeVisible({ timeout: 5000 })
  })

  test('shows error message when Gemini API fails', async ({ page }) => {
    await mockGeminiError(page)
    await navigateToStatsAndOpenModal(page)
    await page.getByTestId('generate-option-stats-table').click()
    await page.getByTestId('generate-submit').click()

    await expect(page.getByTestId('generate-error')).toBeVisible()
    await expect(page.getByTestId('generate-error')).toContainText('API_KEY_INVALID')
    // Can retry after error — option picker still visible
    await expect(page.getByTestId('generate-option-stats-table')).toBeVisible()
  })

  test('real Gemini API call: image or graceful error shown', async ({ page }) => {
    // No route mocking — uses VITE_GEMINI_API_KEY from .env.local.
    // Passes if Gemini returns an image OR if quota/billing blocks it and an error message is shown.
    await navigateToStatsAndOpenModal(page)
    await page.getByTestId('generate-option-mvp').click()
    await page.getByTestId('generate-submit').click()

    await expect(page.getByTestId('generate-loading')).toBeVisible()

    // Wait for either a generated image or an error message (e.g. quota exceeded)
    await expect(
      page.locator('[data-testid="generate-result-image"], [data-testid="generate-error"]')
    ).toBeVisible({ timeout: 30000 })

    const hasImage = await page.getByTestId('generate-result-image').isVisible()
    if (hasImage) {
      // generate-result-image is now a div wrapper; the actual image is inside
      const src = await page.getByTestId('generate-result-image').locator('img').first().getAttribute('src')
      expect(src).toMatch(/^data:image\//)
    } else {
      // Quota / API error — verify a human-readable message is shown
      await expect(page.getByTestId('generate-error')).toBeVisible()
    }
  })

  test('edit prompt drawer shows and lets user change the prompt', async ({ page }) => {
    await mockGeminiSuccess(page)
    await navigateToStatsAndOpenModal(page)

    // Edit prompt toggle not visible until an option is selected
    await expect(page.getByTestId('edit-prompt-toggle')).toHaveCount(0)

    await page.getByTestId('generate-option-mvp').click()

    // Toggle appears after selection
    await expect(page.getByTestId('edit-prompt-toggle')).toBeVisible()
    await expect(page.getByTestId('edit-prompt-textarea')).toHaveCount(0)

    // Open the drawer
    await page.getByTestId('edit-prompt-toggle').click()
    await expect(page.getByTestId('edit-prompt-textarea')).toBeVisible()

    // Textarea pre-populated with a Hebrew prompt
    const initialPrompt = await page.getByTestId('edit-prompt-textarea').inputValue()
    expect(initialPrompt.length).toBeGreaterThan(10)

    // Edit the prompt
    await page.getByTestId('edit-prompt-textarea').fill('צור תמונה פשוטה של כדורגל')

    // Generate uses the edited prompt (Gemini mock confirms the call was made)
    await page.getByTestId('generate-submit').click()
    await expect(page.getByTestId('generate-result-image')).toBeVisible({ timeout: 5000 })

    // Close drawer — toggle closes it
    await page.getByTestId('generate-back').click()
    await page.getByTestId('generate-option-mvp').click()
    await page.getByTestId('edit-prompt-toggle').click()
    await page.getByTestId('edit-prompt-toggle').click()
    await expect(page.getByTestId('edit-prompt-textarea')).toHaveCount(0)
  })

  test('squads mode: no option picker, auto-selects squads, edit prompt works', async ({ page }) => {
    await mockGeminiSuccess(page)

    // Open squads modal from the tournament team builder section
    await page.getByTestId('league-select').selectOption('tournament-3')
    await page.getByTestId('generate-image-btn-squads').click()
    await expect(page.getByTestId('generate-image-modal')).toBeVisible()

    // No option picker in squads mode
    await expect(page.getByTestId('generate-option-winning-team')).toHaveCount(0)
    await expect(page.getByTestId('generate-option-mvp')).toHaveCount(0)

    // Edit prompt toggle immediately visible (squads auto-selected)
    await expect(page.getByTestId('edit-prompt-toggle')).toBeVisible()

    // Open drawer and verify prompt contains squad-related content
    await page.getByTestId('edit-prompt-toggle').click()
    const prompt = await page.getByTestId('edit-prompt-textarea').inputValue()
    expect(prompt).toContain('soccer team roster')

    // Generate works directly
    await page.getByTestId('generate-submit').click()
    await expect(page.getByTestId('generate-result-image')).toBeVisible({ timeout: 5000 })
  })

  test('squads button available in friendly and regular team sections', async ({ page }) => {
    await enableAdminMode(page)

    // Friendly league
    await page.getByTestId('league-select').selectOption('friendly-1')
    await expect(page.getByTestId('generate-image-btn-squads')).toBeVisible()

    // Regular league — team builder section requires admin mode
    await page.getByTestId('league-select').selectOption('regular-1')
    await expect(page.getByTestId('generate-image-btn-squads')).toBeVisible()
  })
})

// ─── Coach selection ───────────────────────────────────────────────────────────

test('fresh load defaults to all-leagues view; coach badge opens login screen, login sets filtered view', async ({ page }) => {
  // Fresh load (no coach in storage) defaults to all-leagues — no login screen
  await page.addInitScript(() => {
    localStorage.removeItem('soccer-zone-coach-id')
  })
  await page.goto('/')
  await page.getByRole('button', { name: /יאללה נשחק/ }).click({ timeout: 2000 }).catch(() => {})

  // App loads directly — no login screen, badge shows "כולם"
  await expect(page.getByTestId('coach-select-screen')).toHaveCount(0)
  await expect(page.getByTestId('coach-badge')).toBeVisible()
  await expect(page.getByTestId('coach-badge')).toContainText('מאמן אחר')

  // Click badge to switch to a named coach
  await page.getByTestId('coach-badge').click()
  await expect(page.getByTestId('coach-select-screen')).toBeVisible()
  await expect(page.getByTestId('coach-login-select')).toBeVisible()
  await expect(page.getByTestId('coach-login-password')).toBeVisible()

  // Log in as zach
  await loginAsCoach(page, 'zach')

  // Login screen gone, badge now shows coach name
  await expect(page.getByTestId('coach-select-screen')).toHaveCount(0)
  await expect(page.getByTestId('coach-badge')).toContainText('צח')
})

test('coach badge switch button returns to selection screen', async ({ page }) => {
  await expect(page.getByTestId('coach-badge')).toBeVisible()
  await page.getByTestId('coach-badge').click()
  await expect(page.getByTestId('coach-select-screen')).toBeVisible()
})

test('coach filter: leagues without coachId are visible to all; leagues with coachId only to that coach', async ({ page }) => {
  await enableAdminMode(page)

  // Navigate to admin panel, select regular-1, capture its display name, then assign to zach
  await page.getByTestId('nav-admin').click()
  await page.getByTestId('league-select').selectOption('regular-1')
  const leagueName = await page.getByTestId('league-name-input').inputValue()
  await page.getByTestId('league-coach-select').selectOption('zach')
  await page.getByTestId('nav-live').click()

  // Switch to rotem — the zach-assigned league should NOT appear in dropdown
  await page.getByTestId('coach-badge').click()
  await loginAsCoach(page, 'rotem')
  const optionsRotem = await page.getByTestId('league-select').locator('option').allTextContents()
  expect(optionsRotem.some((o) => o.includes(leagueName))).toBeFalsy()

  // Switch to zach — the assigned league SHOULD appear
  await page.getByTestId('coach-badge').click()
  await loginAsCoach(page, 'zach')
  const optionsZach = await page.getByTestId('league-select').locator('option').allTextContents()
  expect(optionsZach.some((o) => o.includes(leagueName))).toBeTruthy()
})

test('coach assignment persists after page reload', async ({ page }) => {
  await enableAdminMode(page)

  // Assign regular-1 to zach via admin panel
  await page.getByTestId('nav-admin').click()
  await page.getByTestId('league-select').selectOption('regular-1')
  await page.getByTestId('league-coach-select').selectOption('zach')

  // Wait for save to propagate (debounced 300ms + network round-trip)
  await page.waitForTimeout(2000)

  // Reload the page — coach assignment must survive
  await page.reload()
  await page.getByRole('button', { name: /יאללה נשחק/ }).click({ timeout: 2000 }).catch(() => {})
  await page.getByTestId('nav-admin').click()
  await page.getByTestId('league-select').selectOption('regular-1')

  // The select should still show 'zach' after reload
  await expect(page.getByTestId('league-coach-select')).toHaveValue('zach')
})

// ─── Auto-schedule ─────────────────────────────────────────────────────────────
// regular-1 has 4 teams → (4-1)=3 game days per round, so 1 round = 3 stubs

test('schedule button appears in live mode for regular league with teams; confirm creates (numTeams-1)*rounds stubs', async ({ page }) => {
  await enableAdminMode(page)
  // Select the regular league that already has teams in test data
  await page.getByTestId('league-select').selectOption('regular-1')

  // Schedule 📅 button is visible next to create-tournament
  await expect(page.getByTestId('open-schedule-drawer')).toBeVisible()
  const beforeOptions = await page.getByTestId('tournament-select').locator('option').allTextContents()

  await page.getByTestId('open-schedule-drawer').click()
  await expect(page.getByTestId('schedule-drawer')).toBeVisible()

  // Default rounds=1, 4 teams → 3 stubs displayed
  await expect(page.getByTestId('schedule-confirm')).toContainText('3')

  // Set 2 rounds + final → 3*2+1 = 7 stubs
  await page.getByTestId('schedule-rounds').fill('2')
  await page.getByTestId('schedule-final').check()
  await expect(page.getByTestId('schedule-confirm')).toContainText('7')

  await page.getByTestId('schedule-confirm').click()
  await expect(page.getByTestId('schedule-drawer')).toHaveCount(0)

  // 7 new stubs added on top of existing game days
  const afterOptions = await page.getByTestId('tournament-select').locator('option').allTextContents()
  expect(afterOptions.length).toBe(beforeOptions.length + 7)
  expect(afterOptions[afterOptions.length - 1]).toContain('גמר')
})

test('schedule drawer skip button dismisses drawer without creating stubs', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('regular-1')
  await page.getByTestId('open-schedule-drawer').click()

  await expect(page.getByTestId('schedule-drawer')).toBeVisible()
  const beforeOptions = await page.getByTestId('tournament-select').locator('option').allTextContents()
  await page.getByTestId('schedule-skip').click()

  await expect(page.getByTestId('schedule-drawer')).toHaveCount(0)
  const afterOptions = await page.getByTestId('tournament-select').locator('option').allTextContents()
  expect(afterOptions.length).toBe(beforeOptions.length)
})

// ─── Coach toggle ──────────────────────────────────────────────────────────────

test('toggling between Zach and Admin: each sees only their expected leagues', async ({ page }) => {
  await enableAdminMode(page)

  // As Admin: assign regular-1 to Zach, assign another league to Rotem
  await page.getByTestId('nav-admin').click()
  await page.getByTestId('league-select').selectOption('regular-1')
  const zachLeagueName = await page.getByTestId('league-name-input').inputValue()
  await page.getByTestId('league-coach-select').selectOption('zach')

  // Create a second league assigned to Rotem
  await page.getByTestId('add-league-name').fill('ליגת רותם')
  await page.getByTestId('add-league-type').selectOption('tournament')
  await page.getByTestId('add-league-save').click()
  await page.getByTestId('league-coach-select').selectOption('rotem')

  // Switch to Zach
  await page.getByTestId('coach-badge').click()
  await loginAsCoach(page, 'zach')

  // Zach sees only their assigned league
  const zachOptions = await page.getByTestId('league-select').locator('option').allTextContents()
  expect(zachOptions.some((o) => o.includes(zachLeagueName))).toBeTruthy()
  expect(zachOptions.some((o) => o.includes('ליגת רותם'))).toBeFalsy()

  // Switch back to Admin
  await page.getByTestId('coach-badge').click()
  await loginAsCoach(page, '__admin__')

  // Admin sees all leagues (including both)
  const adminOptions = await page.getByTestId('league-select').locator('option').allTextContents()
  expect(adminOptions.some((o) => o.includes(zachLeagueName))).toBeTruthy()
  expect(adminOptions.some((o) => o.includes('ליגת רותם'))).toBeTruthy()

  // Admin renames Zach's league
  await page.getByTestId('nav-admin').click()
  await page.getByTestId('league-select').selectOption('regular-1')
  const renamedName = zachLeagueName + ' (שונה)'
  await page.getByTestId('league-name-input').fill(renamedName)
  await page.getByTestId('nav-live').click()

  // Switch back to Zach — sees the renamed league
  await page.getByTestId('coach-badge').click()
  await loginAsCoach(page, 'zach')
  const zachOptionsAfter = await page.getByTestId('league-select').locator('option').allTextContents()
  expect(zachOptionsAfter.some((o) => o.includes(renamedName))).toBeTruthy()
})
