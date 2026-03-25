import { expect, test } from '@playwright/test'
import { resetTestData } from './testDataHarness'

const addPlayer = async (page, name) => {
  await page.getByTestId('new-player-input').fill(name)
  await page.getByTestId('add-player-button').click()
}

const addPlayers = async (page, names) => {
  for (const name of names) {
    await addPlayer(page, name)
  }
}

const setTeamPlayer = async (page, teamId, playerName, checked = true) => {
  const checkbox = page.getByTestId(`team-card-${teamId}`).getByRole('checkbox', { name: playerName })
  if (checked) {
    await checkbox.check()
  } else {
    await checkbox.uncheck()
  }
}

test.beforeEach(async ({ page }) => {
  await resetTestData()
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('soccer-zone-active-dataset', 'test')
  })
  await page.goto('/')
})

test.afterEach(async ({ page }) => {
  if (!page.isClosed()) {
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.close()
  }
  await resetTestData()
})

test('main navigation and stats render for the selected league', async ({ page }) => {
  await expect(page.getByTestId('nav-live')).toBeVisible()
  await expect(page.getByTestId('live-standings-table')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'תיקו' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'הפסדים' })).toBeVisible()

  await page.getByTestId('league-select').selectOption('saturday-b')
  await expect(page.locator('[data-testid="tournament-select"] option')).toHaveCount(3)

  await page.getByTestId('league-select').selectOption('friday-noon')
  await page.getByTestId('tournament-select').selectOption('2026-03-15')

  await page.getByTestId('nav-stats').click()
  await expect(page.getByRole('heading', { name: 'סטטיסטיקות כלל הטורנירים - שישי בצהריים' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'טבלת MVP כללית' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'דירוג שערים' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'דירוג בישולים' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'דירוג הגנתי' })).toBeVisible()

  await page.getByTestId('nav-live').click()
  await expect(page.getByTestId('tournament-select')).toBeVisible()
})

test('management controls are separated and saturday a can still start empty', async ({ page }) => {
  await expect(page.getByTestId('management-panel')).toBeVisible()
  await expect(page.getByTestId('admin-toggle')).toBeChecked()
  await expect(page.getByTestId('dataset-select')).toBeEnabled()
  await expect(page.getByTestId('clear-league-data')).toBeEnabled()
  await expect(page.getByTestId('reset-league-to-mock')).toBeEnabled()
  await page.getByTestId('league-select').selectOption('saturday-a')
  await expect(page.getByText('אין טורניר זמין. ניתן ליצור טורניר חדש.')).toBeVisible()

  await page.getByTestId('create-tournament-empty').click()
  await expect(page.getByTestId('tournament-select')).toBeVisible()
  await addPlayer(page, 'שחקן ליגת שבת')
  await expect(page.getByTestId('team-card-team1').getByText('שחקן ליגת שבת')).toBeVisible()

  await page.getByTestId('league-select').selectOption('friday-noon')
  const optionsBefore = await page.locator('[data-testid="tournament-select"] option').count()
  await page.getByTestId('create-tournament').click()
  await expect(page.locator('[data-testid="tournament-select"] option')).toHaveCount(optionsBefore + 1)
})

test('management actions clear the selected league and can restore its mock data after confirmation', async ({
  page,
}) => {
  await page.getByTestId('league-select').selectOption('friday-noon')
  await expect(page.locator('[data-testid="tournament-select"] option')).toHaveCount(2)

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId('clear-league-data').click()
  await expect(page.getByText('אין טורניר זמין. ניתן ליצור טורניר חדש.')).toBeVisible()

  await page.getByTestId('nav-stats').click()
  await expect(page.locator('[data-testid^="player-stats-row-"]')).toHaveCount(0)

  await page.getByTestId('nav-live').click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId('reset-league-to-mock').click()
  await expect(page.locator('[data-testid="tournament-select"] option')).toHaveCount(2)

  await page.getByTestId('nav-stats').click()
  await expect(page.locator('[data-testid^="player-stats-row-"]')).not.toHaveCount(0)
})

test('team builder enforces unique players, max seven players, and team color changes', async ({
  page,
}) => {
  await page.getByTestId('admin-toggle').check()
  await addPlayers(page, ['תוספת 1', 'תוספת 2'])

  await page.getByTestId('team-color-select-team1').selectOption('blue')
  await expect(page.getByTestId('team-card-team1')).toContainText('קבוצת כחול')

  await setTeamPlayer(page, 'team1', 'תוספת 1')
  await expect(page.getByTestId('team-card-team1').getByRole('checkbox', { name: 'תוספת 1' })).toBeChecked()

  await page.getByTestId('team-card-team1').getByRole('checkbox', { name: 'רועי בן דוד' }).click()
  await expect(page.getByTestId('team-builder-message')).toContainText(
    'שחקן לא יכול להיות משויך לשתי קבוצות באותו טורניר.',
  )
  await expect(page.getByTestId('team-card-team1').getByRole('checkbox', { name: 'רועי בן דוד' })).not.toBeChecked()
  await expect(page.getByTestId('team-card-team2').getByRole('checkbox', { name: 'רועי בן דוד' })).toBeChecked()

  await page.getByTestId('team-card-team1').getByRole('checkbox', { name: 'תוספת 2' }).click()
  await expect(page.getByTestId('team-builder-message')).toContainText('אי אפשר להוסיף יותר מ-7 שחקנים לקבוצה.')
  await expect(page.getByTestId('team-card-team1').getByRole('checkbox', { name: 'תוספת 2' })).not.toBeChecked()
})

test('games, scoring events, standings, editing, deleting, undo, and stats updates work end to end', async ({
  page,
}) => {
  await page.getByTestId('admin-toggle').check()
  await page.getByTestId('league-select').selectOption('saturday-a')
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
  await page.getByTestId('score-a-input').fill('2')
  await page.getByTestId('score-b-input').fill('1')
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
  await page.getByTestId('score-a-input').fill('3')
  await page.getByTestId('cancel-edit-game').click()
  await expect(page.getByText('שחור 2 - 1 צהוב')).toBeVisible()

  await page.getByTestId('game-team-a-select').selectOption('team3')
  await page.getByTestId('game-team-b-select').selectOption('team2')
  await page.getByTestId('score-a-input').fill('1')
  await page.getByTestId('score-b-input').fill('0')
  await page.getByTestId('event-scorer-0').selectOption({ label: 'שחקן 5' })
  await page.getByTestId('save-game-button').click()
  await expect(page.getByText('ורוד 1 - 0 צהוב')).toBeVisible()

  await page.getByTestId('undo-last-game').click()
  await expect(page.getByText('ורוד 1 - 0 צהוב')).toHaveCount(0)

  await page.getByRole('button', { name: 'עריכה' }).first().click()
  await page.getByTestId('score-a-input').fill('1')
  await page.getByTestId('score-b-input').fill('1')
  await page.getByTestId('event-scorer-0').selectOption({ label: 'שחקן 1' })
  await page.getByTestId('event-assister-0').selectOption({ label: 'שחקן 2' })
  await page.getByTestId('event-scorer-1').selectOption({ label: 'שחקן 3' })
  await page.getByTestId('save-game-button').click()
  await expect(standingsRows.nth(0)).toContainText('שחור')
  await expect(standingsRows.nth(0)).toContainText('1')

  await page.getByTestId('nav-stats').click()
  await expect(page.getByRole('heading', { name: 'סטטיסטיקות כלל הטורנירים - שבת A' })).toBeVisible()
  const playerOneRow = page.locator('[data-testid^="player-stats-row-"]').filter({ hasText: 'שחקן 1' }).first()
  const playerTwoRow = page.locator('[data-testid^="player-stats-row-"]').filter({ hasText: 'שחקן 2' }).first()
  const playerThreeRow = page.locator('[data-testid^="player-stats-row-"]').filter({ hasText: 'שחקן 3' }).first()
  await expect(playerOneRow).toContainText('שחקן 1')
  await expect(playerOneRow.locator('td').nth(4)).toHaveText('1')
  await expect(playerTwoRow).toContainText('שחקן 2')
  await expect(playerTwoRow.locator('td').nth(5)).toHaveText('1')
  await expect(playerThreeRow).toContainText('שחקן 3')
  await expect(playerThreeRow.locator('td').nth(4)).toHaveText('1')

  await page.getByTestId('nav-live').click()
  await page.getByRole('button', { name: 'מחיקה' }).first().click()
  await expect(page.getByText('שחור 1 - 1 צהוב')).toHaveCount(0)
})

test('editing a seeded game result updates live standings, tournament games, and stats', async ({ page }) => {
  await page.getByTestId('admin-toggle').check()
  await page.getByTestId('league-select').selectOption('saturday-b')
  await page.getByTestId('tournament-select').selectOption('2026-03-07-sb')

  await page.getByTestId('edit-game-sb1-g8').click()
  await page.getByTestId('score-a-input').fill('1')
  await page.getByTestId('score-b-input').fill('0')
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
  await page.getByTestId('admin-toggle').check()
  await page.getByTestId('league-select').selectOption('saturday-b')
  await page.getByTestId('tournament-select').selectOption('2026-03-07-sb')

  const existingGames = page.locator('[data-testid^="game-row-"]')
  const existingCount = await existingGames.count()
  const blackRow = page.locator('[data-testid="live-standings-table"] tbody tr').filter({ hasText: 'שחור' }).first()

  await page.getByTestId('game-team-a-select').selectOption('team1')
  await page.getByTestId('game-team-b-select').selectOption('team3')
  await page.getByTestId('score-a-input').fill('1')
  await page.getByTestId('score-b-input').fill('0')
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

test('stats summary leaders match the maximum values in the stats table', async ({ page }) => {
  await page.getByTestId('league-select').selectOption('saturday-b')
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
  const bestDefenderRatio = Math.min(...stats.map((row) => row.defenderRatio))
  const topScorers = stats.filter((row) => row.goals === topGoals).map((row) => row.name).join(' / ')
  const topAssisters = stats.filter((row) => row.assists === topAssists).map((row) => row.name).join(' / ')
  const bestDefenders = stats
    .filter((row) => row.defenderRatio === bestDefenderRatio)
    .map((row) => row.name)
    .join(' / ')

  const summary = page.getByTestId('player-stats-summary')

  await expect(summary).toContainText(`מלך שערים: ${topScorers}`)
  await expect(summary).toContainText(`מלך בישולים: ${topAssisters}`)
  await expect(summary).toContainText(`שחקן הגנה: ${bestDefenders}`)
})
