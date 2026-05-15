const rankMedalInline = (displayRank) => {
  if (displayRank === 1) return '🥇'
  if (displayRank === 2) return '🥈'
  if (displayRank === 3) return '🥉'
  return `${displayRank}.`
}

// Assign tie-aware display ranks to a sorted row array
const withRanks = (rows, metricKey) => {
  let rank = 1
  return rows.map((row, i) => {
    if (i > 0 && rows[i][metricKey] !== rows[i - 1][metricKey]) rank = i + 1
    return { ...row, displayRank: rank }
  })
}

const TEAM_EMOJI_MAP = {
  'אריות': '🦁',
  'דרקונים': '🐉',
  'זאבים': '🐺',
  'נשרים': '🦅',
  'פנתרים': '🐆',
  'קרנפים': '🦏',
}

const getTeamShortLabel = (team) => {
  if (!team) return ''
  const name = team.name?.trim() || ''
  // Check hard-coded emoji map first (partial match against team name)
  for (const [key, emoji] of Object.entries(TEAM_EMOJI_MAP)) {
    if (name.includes(key)) return emoji
  }
  // Fall back to emoji found in the name itself
  const emojiMatch = name.match(/\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu)
  if (emojiMatch && emojiMatch.length > 0) return emojiMatch[0]
  return name
}

const CompactMetricTable = ({ title, rows, metricLabel, metricKey, playerTeamMap = null }) => {
  const ranked = withRanks(rows, metricKey)
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-base font-bold">{title}</h3>
      <table className="min-w-full text-right text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="w-8 p-2"></th>
            <th className="p-2">שחקן</th>
            {playerTeamMap && <th className="p-2">קבוצה</th>}
            <th className="p-2">{metricLabel}</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row, i) => (
            <tr key={`${title}-${row.playerId}`} data-testid={`compact-${metricKey}-row-${i}`} className="border-b">
              <td className="p-2 text-center text-base leading-none">{rankMedalInline(row.displayRank)}</td>
              <td className="p-2">{row.name}</td>
              {playerTeamMap && (
                <td className="p-2 text-center">{getTeamShortLabel(playerTeamMap.get(row.playerId))}</td>
              )}
              <td className="p-2">{row[metricKey]}</td>
            </tr>
          ))}
          {ranked.length === 0 && (
            <tr>
              <td colSpan={playerTeamMap ? 4 : 3} className="p-2 text-center text-gray-400">
                אין נתונים
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

const PlayerStatsTable = ({ stats, leaders, summaryOnly = false, playerTeamMap = null }) => {
  const topScorers = [...stats].sort((a, b) => b.goals - a.goals || b.assists - a.assists).filter((row) => row.goals > 0)
  const topAssisters = [...stats].sort((a, b) => b.assists - a.assists || b.goals - a.goals).filter((row) => row.assists > 0)
  const bestDefenders = [...stats]
    .filter((row) => row.gamesPlayed > 0 && row.isDefense)
    .sort((a, b) => a.effectiveDefenderRatio - b.effectiveDefenderRatio)

  return (
    <div className="space-y-4" data-testid="player-stats-summary">
      {/* MVP + full table — shown only when NOT in summary-only mode */}
      {!summaryOnly && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">טבלת MVP כללית</h2>
          {leaders.mvp ? (
            <div className="mb-3 rounded-xl bg-gray-100 p-2 text-sm">🏆 MVP: {leaders.mvp.name}</div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2">שחקן</th>
                  {playerTeamMap && <th className="p-2">קבוצה</th>}
                  <th className="p-2">השתתפות</th>
                  <th className="p-2">זכיות טורניר</th>
                  <th className="p-2">ניצחונות משחק</th>
                  <th className="p-2">שערים</th>
                  <th className="p-2">בישולים</th>
                  <th className="p-2">ספיגה</th>
                  <th className="p-2">שערי קבוצה</th>
                  <th className="p-2">יחס הגנתי</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.playerId} data-testid={`player-stats-row-${row.playerId}`} className="border-b">
                    <td className="p-2">{row.name}</td>
                    {playerTeamMap && (
                      <td className="p-2 text-center">{getTeamShortLabel(playerTeamMap.get(row.playerId))}</td>
                    )}
                    <td className="p-2">{row.tournamentsParticipated}</td>
                    <td className="p-2">{row.tournamentsWon}</td>
                    <td className="p-2">{row.totalGamesWon}</td>
                    <td className="p-2">{row.goals}</td>
                    <td className="p-2">{row.assists}</td>
                    <td className="p-2">{row.goalsConceded}</td>
                    <td className="p-2">{row.teamGoalsScored}</td>
                    <td className="p-2">{row.defenderRatio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Ranked tables 1-5 with medals — always shown */}
      <div className="grid gap-4 md:grid-cols-3">
        <CompactMetricTable title="⚽ דירוג שערים" rows={topScorers} metricLabel="שערים" metricKey="goals" playerTeamMap={playerTeamMap} />
        <CompactMetricTable title="🎯 דירוג בישולים" rows={topAssisters} metricLabel="בישולים" metricKey="assists" playerTeamMap={playerTeamMap} />
        <CompactMetricTable
          title="🛡 דירוג הגנתי"
          rows={bestDefenders}
          metricLabel="יחס ספיגה למשחק"
          metricKey="defenderRatio"
          playerTeamMap={playerTeamMap}
        />
      </div>
    </div>
  )
}

export default PlayerStatsTable
