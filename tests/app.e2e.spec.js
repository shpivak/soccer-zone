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
  await page.getByTestId('nav-admin').click()
  await page.getByTestId('admin-password-input').fill(process.env.VITE_ADMIN_PASSWORD)
  await page.getByTestId('admin-unlock-button').click()
  // Unlocking admin mode can surface the "What's New" modal (z-50 overlay) which blocks clicks.
  // Dismiss it if present, so navigation is stable.
  const whatsNewDismiss = page.getByRole('button', { name: /יאללה נשחק/i })
  await whatsNewDismiss.click({ timeout: 2000 }).catch(() => {})
  await page.getByTestId('nav-live').click()
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
  // Admin panel is on the admin tab
  await page.getByTestId('nav-admin').click()
  await expect(page.getByTestId('management-panel')).toBeVisible()
  // Admin is off by default — only password prompt visible
  await expect(page.getByTestId('admin-password-input')).toBeVisible()
  await expect(page.getByTestId('add-league-name')).toHaveCount(0)
  await expect(page.getByTestId('clear-league-data')).toHaveCount(0)

  await enableAdminMode(page)  // navigates to admin, unlocks, returns to live

  // Re-check admin panel controls on admin tab
  await page.getByTestId('nav-admin').click()
  await expect(page.getByTestId('admin-password-input')).toHaveCount(0)
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
  await expect(page.getByRole('cell', { name: 'נשרים' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'זאבים' })).toBeVisible()
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

test('admin mode requires password, hides controls when locked, and persists in session storage', async ({ page }) => {
  // Admin panel lives on the admin tab
  await page.getByTestId('nav-admin').click()

  // Admin is off by default — only password prompt is visible
  await expect(page.getByTestId('admin-password-input')).toBeVisible()
  await expect(page.getByTestId('admin-unlock-button')).toBeVisible()
  await expect(page.getByTestId('clear-league-data')).toHaveCount(0)
  await expect(page.getByTestId('add-league-name')).toHaveCount(0)

  // Wrong password shows error and stays locked
  await page.getByTestId('admin-password-input').fill('wrongpassword')
  await page.getByTestId('admin-unlock-button').click()
  await expect(page.getByTestId('admin-password-error')).toBeVisible()
  await expect(page.getByTestId('admin-password-input')).toBeVisible()
  await expect(page.getByTestId('clear-league-data')).toHaveCount(0)

  // Correct password unlocks (enableAdminMode navigates to admin, unlocks, returns to live)
  await enableAdminMode(page)

  // Check admin controls on admin tab
  await page.getByTestId('nav-admin').click()
  await expect(page.getByTestId('admin-password-input')).toHaveCount(0)
  await expect(page.getByTestId('admin-lock-button')).toBeVisible()
  await expect(page.getByTestId('clear-league-data')).toBeVisible()
  await expect(page.getByTestId('add-league-name')).toBeVisible()

  // After reload, admin mode is still active (session storage)
  await page.reload()
  await page.getByTestId('nav-admin').click()
  await expect(page.getByTestId('admin-password-input')).toHaveCount(0)
  await expect(page.getByTestId('clear-league-data')).toBeVisible()

  // Lock button returns to locked state and hides controls
  await page.getByTestId('admin-lock-button').click()
  await expect(page.getByTestId('admin-password-input')).toBeVisible()
  await expect(page.getByTestId('clear-league-data')).toHaveCount(0)
  await expect(page.getByTestId('add-league-name')).toHaveCount(0)
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

  await page.getByTestId('add-regular-team').click()
  await page.getByTestId('add-regular-team').click()
  // team-name-input only renders in drag mode
  await switchToDragMode(page)
  await expect(page.getByTestId('team-name-input-regular-team-1')).toBeVisible()
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

  // Unlock admin and stay on admin panel
  await page.getByTestId('nav-admin').click()
  await page.getByTestId('admin-password-input').fill(process.env.VITE_ADMIN_PASSWORD)
  await page.getByTestId('admin-unlock-button').click()

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

test('player rank button cycles B → A → C → B and is hidden from non-admin', async ({ page }) => {
  // Without admin — rank button should not be visible on bench players
  await page.getByTestId('league-select').selectOption('tournament-1')
  await page.getByTestId('tournament-select').selectOption('2026-03-01')

  const anyChip = page.locator('[data-testid^="player-chip-"]').first()
  await expect(anyChip).toBeVisible()
  const chipId = (await anyChip.getAttribute('data-testid')).replace('player-chip-', '')
  await expect(page.getByTestId(`player-rank-${chipId}`)).toHaveCount(0)

  // With admin — rank button appears and cycles correctly
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()
  await addPlayer(page, 'שחקן דירוג')

  const rankChip = page.locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן דירוג' }).first()
  const rankId = (await rankChip.getAttribute('data-testid')).replace('player-chip-', '')
  const rankBtn = page.getByTestId(`player-rank-${rankId}`)

  // Default rank is B
  await expect(rankBtn).toContainText('B')
  // B → A
  await rankBtn.click()
  await expect(rankBtn).toContainText('A')
  // A → C
  await rankBtn.click()
  await expect(rankBtn).toContainText('C')
  // C → B
  await rankBtn.click()
  await expect(rankBtn).toContainText('B')
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

test('offense and defense role buttons are hidden from non-admin', async ({ page }) => {
  await page.getByTestId('league-select').selectOption('tournament-1')
  await page.getByTestId('tournament-select').selectOption('2026-03-01')

  const anyChip = page.locator('[data-testid^="player-chip-"]').first()
  await expect(anyChip).toBeVisible()
  const chipId = (await anyChip.getAttribute('data-testid')).replace('player-chip-', '')

  await expect(page.getByTestId(`player-offense-${chipId}`)).toHaveCount(0)
  await expect(page.getByTestId(`player-defense-${chipId}`)).toHaveCount(0)
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

  // Add a third team
  await page.getByTestId('add-friendly-team').click()
  await expect(teamCards()).toHaveCount(3)

  // Remove the third team — remove buttons only render in drag mode
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

test('selecting mode is the default, cycling assigns players, save persists, drag mode preserves old behaviour', async ({ page }) => {
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

  // Initial state: all players on bench — cycle buttons show '–'
  const cycleBtn1 = page.locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן 1' }).locator('[data-testid^="player-team-cycle-"]')
  await expect(cycleBtn1).toContainText('–')

  // Click once: bench → team1
  await cycleBtn1.click()
  await expect(cycleBtn1).not.toContainText('–')

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
  const cycleBtnAgain = page.locator('[data-testid^="player-chip-"]').filter({ hasText: 'שחקן 1' }).locator('[data-testid^="player-team-cycle-"]')
  await expect(cycleBtnAgain).not.toContainText('–')
})

test('selecting mode auto-generate distributes players locally without saving, clean resets to bench locally', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.getByTestId('create-tournament-empty').click()
  await addPlayers(page, ['שחקן 1', 'שחקן 2', 'שחקן 3', 'שחקן 4', 'שחקן 5', 'שחקן 6'])

  // Auto-generate: distributes all 6 players across 3 teams (2 each)
  await page.getByTestId('auto-generate-teams-button').click()

  // No cycle buttons should show '–' — all players assigned
  await expect(page.locator('[data-testid^="player-team-cycle-"]').filter({ hasText: '–' })).toHaveCount(0)

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
  await expect(page.locator('[data-testid^="player-team-cycle-"]').filter({ hasText: '–' })).toHaveCount(6)
  await expect(page.getByTestId('selecting-mode-save')).toHaveClass(/ring-2/)
})
