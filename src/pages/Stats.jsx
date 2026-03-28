import PlayerStatsTable from '../components/PlayerStatsTable'
import ScoreBoard from '../components/ScoreBoard'
import { APP_CONFIG } from '../config'
import { useAppContext } from '../hooks/useAppContext'
import { getLeagueModeLabels, getLeagueTypeLabel, LEAGUE_TYPES } from '../utils/leagueUtils'
import { calculateLeagueStandings, calculatePlayerStats, getLeaders } from '../utils/tournamentUtils'

const Stats = () => {
  const { activeLeagueId, leagues, players, tournaments } = useAppContext()
  const league = leagues.find((item) => item.id === activeLeagueId) ?? null
  const leaguePlayers = players.filter((player) => player.leagueId === activeLeagueId)
  const leagueTournaments = tournaments.filter((tournament) => tournament.leagueId === activeLeagueId)
  const stats = calculatePlayerStats(leaguePlayers, leagueTournaments, APP_CONFIG.points, league?.type)
  const leaders = getLeaders(stats)
  const standings = league ? calculateLeagueStandings(league, leagueTournaments, APP_CONFIG.points) : []
  const labels = getLeagueModeLabels(league?.type)

  if (!league) return null

  return (
    <div className="space-y-4">
      <header className="rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">
          {labels.statsTitle} - {league.name}
        </h1>
        <p className="mt-1 text-sm text-gray-600">סוג ליגה: {getLeagueTypeLabel(league.type)} | עונה: {league.seasonLabel || '-'}</p>
      </header>

      {league.type === LEAGUE_TYPES.regular ? (
        <>
          <ScoreBoard standings={standings} title="טבלת ליגה כוללת" showGoals />
          <PlayerStatsTable stats={stats} leaders={leaders} summaryOnly />
        </>
      ) : (
        <PlayerStatsTable stats={stats} leaders={leaders} />
      )}
    </div>
  )
}

export default Stats
