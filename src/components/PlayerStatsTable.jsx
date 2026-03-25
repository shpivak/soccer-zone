const CompactMetricTable = ({ title, rows, metricLabel, metricKey }) => (
  <section className="rounded-2xl bg-white p-4 shadow-sm">
    <h3 className="mb-3 text-base font-bold">{title}</h3>
    <table className="min-w-full text-right text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="p-2">שחקן</th>
          <th className="p-2">{metricLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${title}-${row.playerId}`} className="border-b">
            <td className="p-2">{row.name}</td>
            <td className="p-2">{row[metricKey]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
)

const formatLeaderNames = (rows) => rows.map((row) => row.name).join(' / ')

const PlayerStatsTable = ({ stats, leaders }) => {
  const topScorers = [...stats].sort((a, b) => b.goals - a.goals).slice(0, 5)
  const topAssisters = [...stats].sort((a, b) => b.assists - a.assists).slice(0, 5)
  const bestDefenders = [...stats]
    .filter((row) => row.gamesPlayed > 0)
    .sort((a, b) => a.defenderRatio - b.defenderRatio)
    .slice(0, 5)

  return (
    <div className="space-y-4">
      <section data-testid="player-stats-summary" className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">טבלת MVP כללית</h2>
        <div className="mb-3 grid gap-2 text-sm md:grid-cols-4">
          <div className="rounded-xl bg-gray-100 p-2">🏆 MVP: {leaders.mvp?.name ?? '-'}</div>
          <div className="rounded-xl bg-gray-100 p-2">
            ⚽ מלך שערים: {formatLeaderNames(leaders.topScorers ?? []) || '-'}
          </div>
          <div className="rounded-xl bg-gray-100 p-2">
            🎯 מלך בישולים: {formatLeaderNames(leaders.topAssisters ?? []) || '-'}
          </div>
          <div className="rounded-xl bg-gray-100 p-2">
            🛡 שחקן הגנה: {formatLeaderNames(leaders.bestDefenders ?? []) || '-'}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-right text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2">שחקן</th>
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

      <div className="grid gap-4 md:grid-cols-3">
        <CompactMetricTable title="דירוג שערים" rows={topScorers} metricLabel="שערים" metricKey="goals" />
        <CompactMetricTable title="דירוג בישולים" rows={topAssisters} metricLabel="בישולים" metricKey="assists" />
        <CompactMetricTable
          title="דירוג הגנתי"
          rows={bestDefenders}
          metricLabel="יחס ספיגה למשחק"
          metricKey="defenderRatio"
        />
      </div>
    </div>
  )
}

export default PlayerStatsTable
