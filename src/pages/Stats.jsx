import { APP_CONFIG } from '../config'
import PlayerStatsTable from '../components/PlayerStatsTable'
import { useAppContext } from '../hooks/useAppContext'
import { calculatePlayerStats, getLeaders } from '../utils/tournamentUtils'

const Stats = () => {
  const { activeLeagueId, players, tournaments } = useAppContext()
  const league = APP_CONFIG.leagues.find((item) => item.id === activeLeagueId)
  const leaguePlayers = players.filter((player) => player.leagueId === activeLeagueId)
  const leagueTournaments = tournaments.filter((tournament) => tournament.leagueId === activeLeagueId)
  const stats = calculatePlayerStats(leaguePlayers, leagueTournaments, APP_CONFIG.points)
  const leaders = getLeaders(stats)

  return (
    <div className="space-y-4">
      <header className="rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">סטטיסטיקות כלל הטורנירים - {league?.name ?? APP_CONFIG.leagueName}</h1>
        <p className="mt-1 text-sm text-gray-600">
          הנתונים מחושבים רק מהליגה הנבחרת כולל שערים, בישולים, ניצחונות והגנה.
        </p>
      </header>
      <PlayerStatsTable stats={stats} leaders={leaders} />
    </div>
  )
}

export default Stats
