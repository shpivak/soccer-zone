import { useMemo, useState } from 'react'
import GameInput from '../components/GameInput'
import ScoreBoard from '../components/ScoreBoard'
import TeamBuilder from '../components/TeamBuilder'
import TournamentTable from '../components/TournamentTable'
import { APP_CONFIG } from '../config'
import { useAppContext } from '../hooks/useAppContext'
import { useTournamentEditor } from '../hooks/useTournamentEditor'
import {
  canEditTeamsInLiveMode,
  getLeagueTypeLabel,
  getLeagueModeLabels,
  getMaxPlayersPerTeam,
  getSessionGamesLimit,
  LEAGUE_TYPES,
} from '../utils/leagueUtils'
import { calculateLeagueStandings, calculateStandings } from '../utils/tournamentUtils'

const LiveTournament = ({ adminMode }) => {
  const { activeLeagueId, leagues, players, tournaments, setLeagues, setPlayers, setTournaments } = useAppContext()
  const league = leagues.find((item) => item.id === activeLeagueId) ?? null
  const leaguePlayers = useMemo(() => players.filter((player) => player.leagueId === activeLeagueId), [activeLeagueId, players])
  const leagueTournaments = useMemo(
    () => tournaments.filter((tournament) => tournament.leagueId === activeLeagueId),
    [activeLeagueId, tournaments],
  )
  const { selectedTournamentId, setSelectedTournamentId, selectedTournament, createTournament } =
    useTournamentEditor(leagueTournaments, leaguePlayers, league)
  const [editingGame, setEditingGame] = useState(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [teamBuilderMessage, setTeamBuilderMessage] = useState('')
  const [gameInputMessage, setGameInputMessage] = useState('')
  const labels = getLeagueModeLabels(league?.type)
  const maxPlayersPerTeam = league ? getMaxPlayersPerTeam(league) : undefined
  const isRegularSetupEditable =
    league?.type === LEAGUE_TYPES.regular &&
    (selectedTournament?.leagueNumber === 1 || league?.allowRosterEdits === true)

  const standings = useMemo(() => {
    if (!league) return []
    if (league.type === LEAGUE_TYPES.regular) {
      return calculateLeagueStandings(league, leagueTournaments, APP_CONFIG.points)
    }
    if (!selectedTournament) return []
    return calculateStandings(selectedTournament, APP_CONFIG.points)
  }, [league, leagueTournaments, selectedTournament])

  const updateSelectedTournament = (updater) => {
    setTournaments((current) =>
      current.map((item) => (item.id === selectedTournamentId ? { ...item, ...updater(item) } : item)),
    )
  }

  const syncRegularLeagueTeams = (updater) => {
    if (!league) return
    let nextTeams = league.teams ?? []
    setLeagues((current) =>
      current.map((item) => {
        if (item.id !== league.id) return item
        nextTeams = updater(item.teams ?? [])
        return { ...item, teams: nextTeams }
      }),
    )
    setTournaments((current) =>
      current.map((item) => (item.leagueId === league.id ? { ...item, teams: nextTeams.map((team) => ({ ...team })) } : item)),
    )
  }

  const handleCreateTournament = () => {
    if (!adminMode || !league) return
    if (league.type === LEAGUE_TYPES.regular && leagueTournaments.length > 0 && (league.teams?.length ?? 0) < 2) {
      setTeamBuilderMessage('בליגה סדירה צריך להגדיר לפחות שתי קבוצות לפני יצירת מחזור.')
      return
    }
    setGameInputMessage('')
    const tournament = createTournament()
    setTournaments((current) => [...current, tournament])
    setSelectedTournamentId(tournament.id)
  }

  const handleMovePlayer = (playerId, teamId) => {
    if (!adminMode || !league) return
    const targetTeams = league.type === LEAGUE_TYPES.regular ? league.teams ?? [] : selectedTournament?.teams ?? []
    const targetTeam = targetTeams.find((team) => team.id === teamId)
    const playerCurrentTeam = targetTeams.find((team) => team.players.includes(playerId))
    const maxPlayersPerTeam = getMaxPlayersPerTeam(league)

    if (teamId && targetTeam && targetTeam.players.length >= maxPlayersPerTeam && playerCurrentTeam?.id !== teamId) {
      setTeamBuilderMessage(`אי אפשר להוסיף יותר מ-${maxPlayersPerTeam} שחקנים לקבוצה.`)
      return
    }

    setTeamBuilderMessage('')
    const applyUpdate = (teams) =>
      teams.map((team) => {
        const removedPlayers = team.players.filter((id) => id !== playerId)
        if (team.id !== teamId) return { ...team, players: removedPlayers }
        return { ...team, players: [...removedPlayers, playerId] }
      })

    if (league.type === LEAGUE_TYPES.regular) {
      syncRegularLeagueTeams(applyUpdate)
      return
    }

    updateSelectedTournament((tournament) => ({ teams: applyUpdate(tournament.teams) }))
  }

  const handleDeletePlayer = (playerId) => {
    if (!adminMode) return
    setPlayers((current) => current.filter((player) => player.id !== playerId))
    if (league.type === LEAGUE_TYPES.regular) {
      syncRegularLeagueTeams((teams) =>
        teams.map((team) => ({ ...team, players: team.players.filter((id) => id !== playerId) }))
      )
    } else if (selectedTournament) {
      updateSelectedTournament((tournament) => ({
        teams: tournament.teams.map((team) => ({
          ...team,
          players: team.players.filter((id) => id !== playerId),
        })),
      }))
    }
  }

  const handleTogglePlayerRole = (playerId, field) => {
    if (!adminMode) return
    setPlayers((current) =>
      current.map((player) => {
        if (player.id !== playerId) return player
        return { ...player, [field]: !player[field] }
      }),
    )
  }

  const handleSaveGame = (game) => {
    if (!adminMode || !selectedTournament || !league) return
    setGameInputMessage('')
    updateSelectedTournament((tournament) => {
      const exists = tournament.games.some((item) => item.id === game.id)
      if (exists) {
        return { games: tournament.games.map((item) => (item.id === game.id ? game : item)) }
      }
      const gameLimit = getSessionGamesLimit(league)
      if (tournament.games.length >= gameLimit) {
        setGameInputMessage(labels.maxGamesMessage(gameLimit))
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
    if (!adminMode || !selectedTournament || !canEditTeamsInLiveMode(league)) return
    setTeamBuilderMessage('')
    updateSelectedTournament((tournament) => ({
      teams: tournament.teams.map((team) => (team.id === teamId ? { ...team, color } : team)),
    }))
  }

  const handleChangeTeamName = (teamId, name) => {
    if (!adminMode || !league || league.type !== LEAGUE_TYPES.regular) return
    syncRegularLeagueTeams((teams) => teams.map((team) => (team.id === teamId ? { ...team, name } : team)))
  }

  const handleAddRegularTeam = () => {
    if (!adminMode || !league || league.type !== LEAGUE_TYPES.regular) return
    if ((league.teams?.length ?? 0) >= APP_CONFIG.regular.maxTeams) {
      setTeamBuilderMessage(`אפשר להגדיר עד ${APP_CONFIG.regular.maxTeams} קבוצות בליגה סדירה.`)
      return
    }
    setTeamBuilderMessage('')
    syncRegularLeagueTeams((teams) => [
      ...teams,
      {
        id: `regular-team-${Date.now()}`,
        name: `קבוצה ${teams.length + 1}`,
        color: APP_CONFIG.allowedTeamColors[teams.length % APP_CONFIG.allowedTeamColors.length] ?? 'gray',
        players: [],
      },
    ])
  }

  const handleAddFriendlyTeam = () => {
    if (!adminMode || !league || league.type !== LEAGUE_TYPES.friendly || !selectedTournament) return
    if ((selectedTournament.teams?.length ?? 0) >= APP_CONFIG.friendly.maxTeams) {
      setTeamBuilderMessage(`אפשר להגדיר עד ${APP_CONFIG.friendly.maxTeams} קבוצות במשחקי ידידות.`)
      return
    }

    setTeamBuilderMessage('')
    updateSelectedTournament((tournament) => ({
      teams: [
        ...tournament.teams,
        {
          id: `friendly-team-${Date.now()}`,
          name: '',
          color: APP_CONFIG.allowedTeamColors[tournament.teams.length % APP_CONFIG.allowedTeamColors.length] ?? 'gray',
          players: [],
        },
      ],
    }))
  }

  const handleAddPlayer = () => {
    if (!adminMode || !newPlayerName.trim()) return
    const nextPlayer = {
      id: `p${Date.now()}`,
      name: newPlayerName.trim(),
      leagueId: activeLeagueId,
      isOffense: false,
      isDefense: false,
    }
    setPlayers((current) => [...current, nextPlayer])
    setNewPlayerName('')
  }

  if (!league) return null

  if (!selectedTournament) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p>{labels.empty}</p>
        <button
          onClick={handleCreateTournament}
          data-testid="create-tournament-empty"
          className="mt-3 rounded-xl bg-black px-4 py-3 text-white"
        >
          {labels.create}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="sticky top-0 z-10 rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">{labels.liveTitle}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedTournament ? (
            <select
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              data-testid="tournament-select"
              className="rounded-xl border p-3"
            >
              {leagueTournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {league.name} {labels.selectLabel} {tournament.leagueNumber ?? '-'} / {tournament.year ?? '-'} - {tournament.date}
                </option>
              ))}
            </select>
          ) : null}
          <button
            onClick={handleCreateTournament}
            disabled={!adminMode}
            data-testid={selectedTournament ? 'create-tournament' : 'create-tournament-empty'}
            className="rounded-xl bg-black px-4 py-3 text-white disabled:opacity-40"
          >
            {selectedTournament ? labels.createAnother : labels.create}
          </button>
          <button
            onClick={handleUndoLastGame}
            disabled={!adminMode || !selectedTournament || selectedTournament.games.length === 0}
            data-testid="undo-last-game"
            className="rounded-xl border px-4 py-3 disabled:opacity-40"
          >
            בטל משחק אחרון
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-600">ליגה נבחרת: {league.name}</p>
        <p className="mt-1 text-sm text-gray-600">
          סוג ליגה: {getLeagueTypeLabel(league.type)} | עונה: {league.seasonLabel || '-'}
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

      {league.type === LEAGUE_TYPES.regular ? (
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">הגדרת קבוצות</h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={league.allowRosterEdits === true}
                  disabled={!adminMode}
                  onChange={(event) =>
                    setLeagues((current) =>
                      current.map((item) =>
                        item.id === league.id ? { ...item, allowRosterEdits: event.target.checked } : item,
                      ),
                    )
                  }
                  data-testid="regular-roster-edit-toggle"
                  className="h-4 w-4"
                />
                <span>אפשר עריכת סגל</span>
              </label>
              <button
                onClick={handleAddRegularTeam}
                disabled={!adminMode || !isRegularSetupEditable}
                data-testid="add-regular-team"
                className="rounded-xl border px-3 py-2 text-sm disabled:opacity-40"
              >
                הוסף קבוצה
              </button>
            </div>
          </div>
          <TeamBuilder
            teams={selectedTournament?.teams ?? []}
            players={leaguePlayers}
            maxPlayersPerTeam={maxPlayersPerTeam}
            disabled={!adminMode || !isRegularSetupEditable}
            onMovePlayer={handleMovePlayer}
            onChangeTeamColor={() => {}}
            onChangeTeamName={handleChangeTeamName}
            onTogglePlayerRole={handleTogglePlayerRole}
            onDeletePlayer={handleDeletePlayer}
            message={teamBuilderMessage}
            allowColorEdit={false}
            allowNameEdit={isRegularSetupEditable}
          />
        </section>
      ) : league.type === LEAGUE_TYPES.friendly ? (
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">בניית קבוצות ידידות</h2>
            <button
              onClick={handleAddFriendlyTeam}
              disabled={!adminMode}
              data-testid="add-friendly-team"
              className="rounded-xl border px-3 py-2 text-sm disabled:opacity-40"
            >
              הוסף קבוצה
            </button>
          </div>
          <TeamBuilder
            teams={selectedTournament?.teams ?? []}
            players={leaguePlayers}
            maxPlayersPerTeam={maxPlayersPerTeam}
            disabled={!adminMode}
            onMovePlayer={handleMovePlayer}
            onChangeTeamColor={handleChangeTeamColor}
            onTogglePlayerRole={handleTogglePlayerRole}
            onDeletePlayer={handleDeletePlayer}
            message={teamBuilderMessage}
          />
        </section>
      ) : (
        <TeamBuilder
          teams={selectedTournament?.teams ?? []}
          players={leaguePlayers}
          maxPlayersPerTeam={maxPlayersPerTeam}
          disabled={!adminMode}
          onMovePlayer={handleMovePlayer}
          onChangeTeamColor={handleChangeTeamColor}
          onTogglePlayerRole={handleTogglePlayerRole}
          onDeletePlayer={handleDeletePlayer}
          message={teamBuilderMessage}
        />
      )}

      {selectedTournament ? (
        <>
          <GameInput
            key={editingGame?.id ?? `${selectedTournament.id}-new-game`}
            teams={selectedTournament.teams}
            players={leaguePlayers}
            disabled={!adminMode}
            onSave={handleSaveGame}
            editingGame={editingGame}
            onCancelEdit={() => setEditingGame(null)}
            message={gameInputMessage}
          />

          {league.type !== LEAGUE_TYPES.friendly ? (
            <ScoreBoard
              standings={standings}
              title={league.type === LEAGUE_TYPES.regular ? 'טבלת ליגה כוללת' : 'טבלת מצב חיה'}
              showGoals={league.type === LEAGUE_TYPES.regular}
            />
          ) : null}

          <TournamentTable
            league={league}
            games={selectedTournament.games}
            teams={selectedTournament.teams}
            readOnly={!adminMode}
            onEdit={setEditingGame}
            onDelete={handleDeleteGame}
          />
        </>
      ) : null}
    </div>
  )
}

export default LiveTournament
