import { getTeamDisplayName } from './leagueUtils'

const getPlayerName = (playerId, players) => players.find((p) => p.id === playerId)?.name ?? ''

const rankEmoji = (rank) => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${rank}.`
}

// Takes a sorted array, groups ties, returns ranked lines up to maxPlaces
const getRankedLines = (sorted, getValue, getName, suffix, maxPlaces = 5) => {
  const lines = []
  let rank = 1
  let i = 0
  while (i < sorted.length && lines.length < maxPlaces) {
    const val = getValue(sorted[i])
    if (val === 0) break
    const group = []
    while (i < sorted.length && getValue(sorted[i]) === val) {
      group.push(getName(sorted[i]))
      i++
    }
    lines.push(`${rankEmoji(rank)} ${group.join(' / ')} (${val} ${suffix})`)
    rank += group.length
  }
  return lines.join('\n')
}

const getTournamentRankedStats = (games, players) => {
  const goalCount = {}
  const assistCount = {}
  for (const game of games) {
    for (const event of game.events ?? []) {
      if (event.scorer) goalCount[event.scorer] = (goalCount[event.scorer] ?? 0) + 1
      if (event.assister) assistCount[event.assister] = (assistCount[event.assister] ?? 0) + 1
    }
  }

  const toSorted = (countMap) =>
    Object.entries(countMap)
      .map(([id, count]) => ({ id, count, name: getPlayerName(id, players) }))
      .sort((a, b) => b.count - a.count)

  return { scorers: toSorted(goalCount), assisters: toSorted(assistCount) }
}

export const generateDayShareMessage = (tournament, teams, players, leagueName, standings = [], { includeResults = true } = {}) => {
  const date = tournament.date ?? ''
  const games = tournament.games ?? []

  const getTeamName = (teamId) => getTeamDisplayName(teams.find((t) => t.id === teamId))

  const { scorers, assisters } = getTournamentRankedStats(games, players)

  const scorerLines = getRankedLines(scorers, (e) => e.count, (e) => e.name, 'שערים')
  const assisterLines = getRankedLines(assisters, (e) => e.count, (e) => e.name, 'בישולים')

  let msg = `⚽ *${leagueName}*\n📅 ${date}`

  if (includeResults) {
    const resultsLines = games
      .map((game) => {
        const line = `${getTeamName(game.teamA)} ${game.score.a} – ${game.score.b} ${getTeamName(game.teamB)}`
        return game.description ? `${line}\n   📝 ${game.description}` : line
      })
      .join('\n')
    msg += `\n\n📋 תוצאות:\n${resultsLines || 'אין משחקים'}`
  }

  if (standings.length > 0) {
    msg += `\n\n📊 טבלת סיום:`
    standings.forEach((row, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
      msg += `\n${medal} ${row.teamName} – ${row.points} נק׳`
    })
  }

  if (scorerLines) msg += `\n\n🥅 כובשים:\n${scorerLines}`
  if (assisterLines) msg += `\n\n🎯 מבשלים:\n${assisterLines}`

  return msg
}

export const generateOverallShareMessage = (stats, leaders, standings, leagueName) => {
  let msg = `🏆 *${leagueName} – סיכום כללי*`

  // Teams standings — only when passed (regular leagues)
  if (standings.length > 0) {
    msg += `\n\n📊 טבלת ניקוד:`
    standings.forEach((row, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
      msg += `\n${medal} ${row.teamName} – ${row.points} נק׳`
    })
  }

  // Scorers 1-5
  const sortedScorers = [...stats].sort((a, b) => b.goals - a.goals || b.assists - a.assists)
  const scorerLines = getRankedLines(sortedScorers, (p) => p.goals, (p) => p.name, 'שערים')
  if (scorerLines) msg += `\n\n⚽ מלך שערים:\n${scorerLines}`

  // Assisters 1-5
  const sortedAssisters = [...stats].sort((a, b) => b.assists - a.assists || b.goals - a.goals)
  const assisterLines = getRankedLines(sortedAssisters, (p) => p.assists, (p) => p.name, 'בישולים')
  if (assisterLines) msg += `\n\n🎯 מלך בישולים:\n${assisterLines}`

  // MVP
  if (leaders?.mvp) msg += `\n\n🏆 MVP: *${leaders.mvp.name}*`

  return msg
}

export const generateCombinedShareMessage = (dayMsg, overallMsg) => `${dayMsg}\n\n───────────────\n\n${overallMsg}`

export const shareViaWhatsApp = (message) => {
  const encoded = encodeURIComponent(message)
  if (navigator.share) {
    navigator.share({ text: message }).catch(() => {
      window.open(`https://wa.me/?text=${encoded}`, '_blank')
    })
  } else {
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }
}
