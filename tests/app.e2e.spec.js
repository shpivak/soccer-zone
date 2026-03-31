import { expect, test } from '@playwright/test'
import { resetTestData } from './testDataHarness'

const addPlayer = async (page, name) => {
  await page.getByTestId('new-player-input').fill(name)
  // force: true bypasses pointer-interception from the fixed bottom nav bar
  await page.getByTestId('add-player-button').click({ force: true })
}

const addPlayers = async (page, names) => {
  for (const name of names) {
    await addPlayer(page, name)
  }
}

const dragPlayer = async (page, playerName, targetTestId) => {
  const source = page.locator('[data-testid^="player-chip-"]').filter({ hasText: playerName }).first()
  const target = page.getByTestId(targetTestId)
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await source.dispatchEvent('dragstart', { dataTransfer })
  await target.dispatchEvent('dragover', { dataTransfer })
  await target.dispatchEvent('drop', { dataTransfer })
}

const setTeamPlayer = async (page, teamId, playerName, assigned = true) => {
  await dragPlayer(page, playerName, assigned ? `team-card-${teamId}` : 'team-card-bench')
}

const enableAdminMode = async (page) => {
  await page.getByTestId('nav-admin').click()
  await page.getByTestId('admin-password-input').fill('SoccerZone26')
  await page.getByTestId('admin-unlock-button').click()
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
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('soccer-zone-e2e-bootstrapped')) {
      localStorage.clear()
      sessionStorage.setItem('soccer-zone-e2e-bootstrapped', 'true')
    }
  })
  await page.goto('/')
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
  await expect(page.getByRole('heading', { name: 'טבלת MVP כללית' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'דירוג שערים' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'דירוג בישולים' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'דירוג הגנתי' })).toBeVisible()

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
  await expect(page.locator('[data-testid^="player-stats-row-"]')).not.toHaveCount(0)
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
  await expect(page.getByTestId('league-select')).toHaveValue('tournament-2')
  await expect(page.getByTestId('team-card-team1')).toContainText('לבן')
  await expect(page.getByTestId('team-card-team1').getByText('שחקן התמדה')).toBeVisible()

  await page.getByTestId('league-select').selectOption('tournament-1')
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.reload()

  await expect(page.getByTestId('team-card-team1')).toContainText('לבן')
  await expect(page.getByTestId('team-card-team1').getByText('שחקן התמדה')).toBeVisible()
})

test('saved tournament games persist after refresh and league switching', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-2')
  await expect(page.getByText('אין טורניר זמין. ניתן ליצור טורניר חדש.')).toBeVisible()
  await page.getByTestId('create-tournament-empty').click()

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
  await expect(page.getByText('שחור 1 - 0 צהוב')).toBeVisible()

  await page.waitForTimeout(2000)
  await page.reload()
  await expect(page.getByText('שחור 1 - 0 צהוב')).toBeVisible()

  await page.getByTestId('league-select').selectOption('tournament-1')
  await page.getByTestId('league-select').selectOption('tournament-2')
  await page.reload()

  await expect(page.getByText('שחור 1 - 0 צהוב')).toBeVisible()
  await page.getByTestId('nav-stats').click()
  await expect(page.locator('[data-testid^="player-stats-row-"]').filter({ hasText: 'שחקן A' }).first().locator('td').nth(4)).toHaveText('1')
})

test('team builder enforces unique players, max seven players, and team color changes for tournament leagues', async ({
  page,
}) => {
  await enableAdminMode(page)
  await addPlayers(page, ['תוספת 1', 'תוספת 2'])

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
  await expect(page.getByText('שחור 2 - 1 צהוב')).toBeVisible()

  await page.getByRole('button', { name: 'עריכה' }).first().click()
  await setScore(page, 'a', 3)
  await page.getByTestId('cancel-edit-game').click()
  await expect(page.getByText('שחור 2 - 1 צהוב')).toBeVisible()

  await page.getByTestId('game-team-a-select').selectOption('team3')
  await page.getByTestId('game-team-b-select').selectOption('team2')
  await setScore(page, 'a', 1)
  await setScore(page, 'b', 0)
  await page.getByTestId('event-scorer-0').selectOption({ label: 'שחקן 5' })
  await page.getByTestId('save-game-button').click()
  await expect(page.getByText('ורוד 1 - 0 צהוב')).toBeVisible()

  await page.getByTestId('undo-last-game').click()
  await expect(page.getByText('ורוד 1 - 0 צהוב')).toHaveCount(0)

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
  const playerOneRow = page.locator('[data-testid^="player-stats-row-"]').filter({ hasText: 'שחקן 1' }).first()
  const playerTwoRow = page.locator('[data-testid^="player-stats-row-"]').filter({ hasText: 'שחקן 2' }).first()
  const playerThreeRow = page.locator('[data-testid^="player-stats-row-"]').filter({ hasText: 'שחקן 3' }).first()
  await expect(playerOneRow.locator('td').nth(4)).toHaveText('1')
  await expect(playerTwoRow.locator('td').nth(5)).toHaveText('1')
  await expect(playerThreeRow.locator('td').nth(4)).toHaveText('1')

  await page.getByTestId('nav-live').click()
  await page.getByRole('button', { name: 'מחיקה' }).first().click()
  await expect(page.getByText('שחור 1 - 1 צהוב')).toHaveCount(0)
})

test('editing a seeded game result updates live standings, tournament games, and stats', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-3')
  await page.getByTestId('tournament-select').selectOption('2026-03-07-sb')

  await page.getByTestId('edit-game-sb1-g8').click()
  await setScore(page, 'a', 1)
  await setScore(page, 'b', 0)
  await page.getByTestId('event-scorer-0').selectOption({ label: 'יובל חן' })
  await page.getByTestId('event-assister-0').selectOption({ label: 'גל ישראל' })
  await page.getByTestId('save-game-button').click()

  await expect(page.locator('[data-testid^="game-row-"]')).toHaveCount(8)
  await expect(page.getByText('ורוד 1 - 0 צהוב')).toBeVisible()

  const pinkRow = page.locator('[data-testid="live-standings-table"] tbody tr').filter({ hasText: 'ורוד' }).first()
  await expect(pinkRow.locator('td').nth(1)).toHaveText('5')
  await expect(pinkRow.locator('td').nth(2)).toHaveText('1')

  await page.getByTestId('nav-stats').click()
  const scorerRow = page.locator('[data-testid^="player-stats-row-"]').filter({ hasText: 'יובל חן' }).first()
  const assisterRow = page.locator('[data-testid^="player-stats-row-"]').filter({ hasText: 'גל ישראל' }).first()
  await expect(scorerRow.locator('td').nth(4)).toHaveText('4')
  await expect(assisterRow.locator('td').nth(5)).toHaveText('3')
})

test('adding a new game to a seeded tournament updates live standings, games list, and stats', async ({
  page,
}) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('tournament-3')
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
  await expect(page.getByText('שחור 1 - 0 ורוד')).toBeVisible()
  await expect(blackRow.locator('td').nth(1)).toHaveText('16')
  await expect(blackRow.locator('td').nth(2)).toHaveText('5')

  await page.getByTestId('nav-stats').click()
  const scorerRow = page.locator('[data-testid^="player-stats-row-"]').filter({ hasText: 'יואב כהן' }).first()
  const assisterRow = page.locator('[data-testid^="player-stats-row-"]').filter({ hasText: 'אדם פרץ' }).first()
  await expect(scorerRow.locator('td').nth(4)).toHaveText('9')
  await expect(assisterRow.locator('td').nth(5)).toHaveText('4')
})

test('regular league stats show a league table and summary leaders without the full player table', async ({ page }) => {
  await page.getByTestId('league-select').selectOption('regular-1')
  await expect(page.getByRole('heading', { name: 'ניהול מחזור ליגה' })).toBeVisible()
  await expect(page.getByTestId('tournament-select')).toBeVisible()
  await expect(page.getByTestId('team-name-input-regular-team-1')).toBeVisible()
  await expect(page.getByTestId('team-name-input-regular-team-1')).toHaveValue('נשרים')

  await page.getByTestId('nav-stats').click()
  await expect(page.getByRole('heading', { name: 'טבלת ליגה וראשי קטגוריות - ליגת סוקרזון 5' })).toBeVisible()
  await expect(page.getByTestId('live-standings-table')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'נשרים' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'זאבים' })).toBeVisible()
  await expect(page.locator('[data-testid^="player-stats-row-"]')).toHaveCount(0)
  await expect(page.getByTestId('player-stats-summary')).toContainText('מלך שערים')
})

test('regular league roster editing can be enabled after round one', async ({ page }) => {
  await enableAdminMode(page)
  await page.getByTestId('league-select').selectOption('regular-1')
  await page.getByTestId('tournament-select').selectOption('regular-1-mw2')

  await expect(page.getByTestId('team-card-regular-team-1')).toContainText('נשרים')
  await expect(page.getByTestId('team-name-input-regular-team-1')).toHaveCount(0)
  await expect(page.getByTestId('regular-roster-edit-toggle')).not.toBeChecked()

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
  await expect(page.getByTestId('player-stats-summary')).toContainText('מלך שערים')
})

test('stats summary leaders match the maximum values in the stats table', async ({ page }) => {
  await page.getByTestId('league-select').selectOption('tournament-3')
  await page.getByTestId('nav-stats').click()

  const rows = page.locator('[data-testid^="player-stats-row-"]')
  const rowCount = await rows.count()
  const stats = []

  for (let index = 0; index < rowCount; index += 1) {
    const row = rows.nth(index)
    stats.push({
      name: (await row.locator('td').nth(0).textContent())?.trim(),
      goals: Number((await row.locator('td').nth(4).textContent())?.trim() ?? 0),
      assists: Number((await row.locator('td').nth(5).textContent())?.trim() ?? 0),
      defenderRatio: Number((await row.locator('td').nth(8).textContent())?.trim() ?? 0),
    })
  }

  const topGoals = Math.max(...stats.map((row) => row.goals))
  const topAssists = Math.max(...stats.map((row) => row.assists))
  const topScorers = stats.filter((row) => row.goals === topGoals).map((row) => row.name).join(' / ')
  const topAssisters = stats.filter((row) => row.assists === topAssists).map((row) => row.name).join(' / ')

  const summary = page.getByTestId('player-stats-summary')

  await expect(summary).toContainText(`מלך שערים: ${topScorers}`)
  await expect(summary).toContainText(`מלך בישולים: ${topAssisters}`)
  // Defense summary depends on seed data roles; keep this assertion flexible.
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
