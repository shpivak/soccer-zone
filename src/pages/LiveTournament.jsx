import { useMemo, useState } from 'react'
import GameInput from '../components/GameInput'
import ScoreBoard from '../components/ScoreBoard'
import TeamBuilder from '../components/TeamBuilder'
import TournamentTable from '../components/TournamentTable'
import { APP_CONFIG } from '../config'
import { useAppContext } from '../hooks/useAppContext'
import { useTournamentEditor } from '../hooks/useTournamentEditor'
import { calculateStandings } from '../utils/tournamentUtils'

const LiveTournament = ({ adminMode }) => {
  const { activeLeagueId, players, tournaments, setPlayers, setTournaments } = useAppContext()
  const league = APP_CONFIG.leagues.find((item) => item.id === activeLeagueId)
  const leaguePlayers = useMemo(
    () => players.filter((player) => player.leagueId === activeLeagueId),
    [activeLeagueId, players],
  )
  const leagueTournaments = useMemo(
    () => tournaments.filter((tournament) => tournament.leagueId === activeLeagueId),
    [activeLeagueId, tournaments],
  )
  const { selectedTournamentId, setSelectedTournamentId, selectedTournament, createTournament } =
    useTournamentEditor(leagueTournaments, leaguePlayers, activeLeagueId)
  const [editingGame, setEditingGame] = useState(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [teamBuilderMessage, setTeamBuilderMessage] = useState('')
  const [gameInputMessage, setGameInputMessage] = useState('')

  const standings = useMemo(() => {
    if (!selectedTournament) return []
    return calculateStandings(selectedTournament, APP_CONFIG.points)
  }, [selectedTournament])

  const updateSelectedTournament = (updater) => {
    setTournaments((current) =>
      current.map((item) =>
        item.id === selectedTournamentId ? { ...item, ...updater(item) } : item,
      ),
    )
    // FUTURE: replace with Supabase insert/update
    // supabase.from('tournaments').update(...)
  }

  const handleCreateTournament = () => {
    if (!adminMode) return
    setGameInputMessage('')
    const tournament = createTournament()
    setTournaments((current) => [...current, tournament])
    setSelectedTournamentId(tournament.id)
  }

  const handleAssignPlayer = (teamId, playerId, checked) => {
    if (!adminMode || !selectedTournament) return
    const targetTeam = selectedTournament.teams.find((team) => team.id === teamId)
    const playerCurrentTeam = selectedTournament.teams.find((team) => team.players.includes(playerId))

    if (checked && playerCurrentTeam && playerCurrentTeam.id !== teamId) {
      setTeamBuilderMessage('שחקן לא יכול להיות משויך לשתי קבוצות באותו טורניר.')
      return
    }

    if (checked && targetTeam && targetTeam.players.length >= APP_CONFIG.maxPlayersPerTeam) {
      setTeamBuilderMessage(`אי אפשר להוסיף יותר מ-${APP_CONFIG.maxPlayersPerTeam} שחקנים לקבוצה.`)
      return
    }

    setTeamBuilderMessage('')
    updateSelectedTournament((tournament) => ({
      teams: tournament.teams.map((team) => {
        const removedPlayers = team.players.filter((id) => id !== playerId)
        if (team.id !== teamId) return { ...team, players: removedPlayers }
        return { ...team, players: checked ? [...removedPlayers, playerId] : removedPlayers }
      }),
    }))
  }

  const handleSaveGame = (game) => {
    if (!adminMode || !selectedTournament) return
    setGameInputMessage('')
    updateSelectedTournament((tournament) => {
      const exists = tournament.games.some((item) => item.id === game.id)
      if (exists) {
        return { games: tournament.games.map((item) => (item.id === game.id ? game : item)) }
      }
      if (tournament.games.length >= APP_CONFIG.gamesPerTournament) {
        setGameInputMessage(`אי אפשר להוסיף יותר מ-${APP_CONFIG.gamesPerTournament} משחקים לטורניר.`)
        return { games: tournament.games }
      }
      return { games: [...tournament.games, { ...game, round: tournament.games.length + 1 }] }
    })
    setEditingGame(null)
  }

  const handleDeleteGame = (gameId) => {
    if (!adminMode || !selectedTournament) return
    setGameInputMessage('')
    updateSelectedTournament((tournament) => ({
      games: tournament.games.filter((game) => game.id !== gameId),
    }))
  }

  const handleUndoLastGame = () => {
    if (!adminMode || !selectedTournament) return
    setGameInputMessage('')
    updateSelectedTournament((tournament) => ({
      games: tournament.games.slice(0, -1),
    }))
  }

  const handleChangeTeamColor = (teamId, color) => {
    if (!adminMode || !selectedTournament) return
    setTeamBuilderMessage('')
    setGameInputMessage('')
    updateSelectedTournament((tournament) => ({
      teams: tournament.teams.map((team) => (team.id === teamId ? { ...team, color } : team)),
    }))
  }

  const handleAddPlayer = () => {
    if (!adminMode || !newPlayerName.trim()) return
    const nextPlayer = { id: `p${Date.now()}`, name: newPlayerName.trim(), leagueId: activeLeagueId }
    setPlayers((current) => [...current, nextPlayer])
    // FUTURE: replace with Supabase insert/update
    // supabase.from('players').insert(nextPlayer)
    setNewPlayerName('')
  }

  if (!selectedTournament) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p>אין טורניר זמין. ניתן ליצור טורניר חדש.</p>
        <button
          onClick={handleCreateTournament}
          data-testid="create-tournament-empty"
          className="mt-3 rounded-xl bg-black px-4 py-3 text-white"
        >
          צור טורניר
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="sticky top-0 z-10 rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">ניהול טורניר חי</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={selectedTournamentId}
            onChange={(e) => setSelectedTournamentId(e.target.value)}
            data-testid="tournament-select"
            className="rounded-xl border p-3"
          >
            {leagueTournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {league?.name ?? APP_CONFIG.leagueName} {tournament.leagueNumber ?? '-'} /{' '}
                {tournament.year ?? '-'} - {tournament.date}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreateTournament}
            disabled={!adminMode}
            data-testid="create-tournament"
            className="rounded-xl bg-black px-4 py-3 text-white disabled:opacity-40"
          >
            טורניר חדש
          </button>
          <button
            onClick={handleUndoLastGame}
            disabled={!adminMode || selectedTournament.games.length === 0}
            data-testid="undo-last-game"
            className="rounded-xl border px-4 py-3 disabled:opacity-40"
          >
            בטל משחק אחרון
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          ליגה נבחרת: {league?.name ?? APP_CONFIG.leagueName}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {league?.name ?? APP_CONFIG.leagueName} {selectedTournament.leagueNumber ?? '-'} /{' '}
          {selectedTournament.year ?? '-'}
        </p>
      </header>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">הוספת שחקן חדש</h2>
        <div className="flex gap-2">
          <input
            value={newPlayerName}
            disabled={!adminMode}
            onChange={(event) => setNewPlayerName(event.target.value)}
            placeholder="הקלד שם שחקן חדש"
            data-testid="new-player-input"
            className="flex-1 rounded-xl border p-3"
          />
          <button
            onClick={handleAddPlayer}
            disabled={!adminMode || !newPlayerName.trim()}
            data-testid="add-player-button"
            className="rounded-xl bg-black px-4 py-3 text-white disabled:opacity-40"
          >
            הוסף
          </button>
        </div>
      </section>

      <TeamBuilder
        teams={selectedTournament.teams}
        players={leaguePlayers}
        disabled={!adminMode}
        onAssignPlayer={handleAssignPlayer}
        onChangeTeamColor={handleChangeTeamColor}
        message={teamBuilderMessage}
      />

      <GameInput
        key={editingGame?.id ?? 'new-game'}
        teams={selectedTournament.teams}
        players={leaguePlayers}
        disabled={!adminMode}
        onSave={handleSaveGame}
        editingGame={editingGame}
        onCancelEdit={() => setEditingGame(null)}
        message={gameInputMessage}
      />

      <ScoreBoard standings={standings} />

      <TournamentTable
        games={selectedTournament.games}
        teams={selectedTournament.teams}
        readOnly={!adminMode}
        onEdit={setEditingGame}
        onDelete={handleDeleteGame}
      />
    </div>
  )
}

export default LiveTournament
