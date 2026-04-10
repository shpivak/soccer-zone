import { useMemo } from 'react'
import PlayerStatsTable from '../components/PlayerStatsTable'
import ScoreBoard from '../components/ScoreBoard'
import ShareButton from '../components/ShareButton'
import { APP_CONFIG } from '../config'
import { useAppContext } from '../hooks/useAppContext'
import { getLeagueModeLabels, getLeagueTypeLabel, LEAGUE_TYPES } from '../utils/leagueUtils'
import { calculateLeagueStandings, calculatePlayerStats, getLeaders } from '../utils/tournamentUtils'
import { buildLeagueShareUrl, generateOverallShareMessage } from '../utils/shareUtils'

const Stats = () => {
  const { activeLeagueId, leagues, players, tournaments } = useAppContext()
  const league = leagues.find((item) => item.id === activeLeagueId) ?? null
  const leaguePlayers = players.filter((player) => player.leagueId === activeLeagueId)
  const leagueTournaments = tournaments.filter((tournament) => tournament.leagueId === activeLeagueId)
  const stats = calculatePlayerStats(leaguePlayers, leagueTournaments, APP_CONFIG.points, league?.type)
  const leaders = getLeaders(stats)
  const standings = useMemo(
    () => (league ? calculateLeagueStandings(league, leagueTournaments, APP_CONFIG.points) : []),
    [league, leagueTournaments],
  )
  const labels = getLeagueModeLabels(league?.type)

  const overallShareMsg = useMemo(
    () => generateOverallShareMessage(stats, leaders, standings, league?.name ?? '', league ? buildLeagueShareUrl(league.id) : ''),
    [stats, leaders, standings, league],
  )

  if (!league) return null

  return (
    <div className="space-y-4">
      <header className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">
              {labels.statsTitle} - {league.name}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              סוג ליגה: {getLeagueTypeLabel(league.type)} | עונה: {league.seasonLabel || '-'}
            </p>
          </div>
          <ShareButton message={overallShareMsg} label="שתף סטט׳ ליגה" name="overall" />
        </div>
      </header>

      {league.type === LEAGUE_TYPES.regular && (
        <ScoreBoard standings={standings} title="טבלת ליגה כוללת" showGoals />
      )}
      <PlayerStatsTable stats={stats} leaders={leaders} summaryOnly />

      {/* Per-tournament / matchweek breakdown
      {tournamentSummaries.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-bold">סיכום לפי {getSessionLabel(league)}</h2>
          <div className="space-y-2">
            {tournamentSummaries.map((t) => (
              <div key={t.id} className="rounded-xl border px-3 py-2 text-sm">
                <div className="mb-1 font-semibold text-gray-700">
                  {labels.selectLabel} {t.leagueNumber ?? ''} – {t.date}
                  <span className="ml-2 text-xs font-normal text-gray-400">({t.gamesCount} משחקים)</span>
                </div>
                <div className="flex flex-wrap gap-4 text-gray-600">
                  {t.topScorers.length > 0 && (
                    <span>
                      ⚽ {t.topScorers.map((p) => p.name).join(' / ')}{' '}
                      <span className="text-gray-400">({t.topScorers[0].count} שערים)</span>
                    </span>
                  )}
                  {t.topAssisters.length > 0 && (
                    <span>
                      🎯 {t.topAssisters.map((p) => p.name).join(' / ')}{' '}
                      <span className="text-gray-400">({t.topAssisters[0].count} בישולים)</span>
                    </span>
                  )}
                  {t.topScorers.length === 0 && t.topAssisters.length === 0 && (
                    <span className="text-gray-400">אין נתוני כובשים</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      */}
    </div>
  )
}

export default Stats
