import { useMemo, useState } from 'react'
import CollapsibleSection from '../components/CollapsibleSection'
import GameInput from '../components/GameInput'
import ScoreBoard from '../components/ScoreBoard'
import ShareButton from '../components/ShareButton'
import TeamBuilder from '../components/TeamBuilder'
import TournamentTable from '../components/TournamentTable'
import { APP_CONFIG } from '../config'
import { useAppContext } from '../hooks/useAppContext'
import { useTournamentEditor } from '../hooks/useTournamentEditor'
import {
  applySessionCustomNameToTeams,
  canEditTeamsInLiveMode,
  getLeagueModeLabels,
  getMaxPlayersPerTeam,
  getSessionDisplayName,
  getSessionLabel,
  LEAGUE_TYPES,
} from '../utils/leagueUtils'
import {
  calculateLeagueStandings,
  calculatePlayerStats,
  calculateStandings,
  getLeaders,
} from '../utils/tournamentUtils'
import { generateBalancedTeams } from '../utils/teamGenerator'
import {
  buildLeagueShareUrl,
  generateCombinedShareMessage,
  generateDayShareMessage,
  generateOverallShareMessage,
  generateTeamShareMessage,
} from '../utils/shareUtils'

const getTournamentTopStats = (games, players) => {
  const goalCount = {}
  const assistCount = {}
  for (const game of games) {
    for (const event of game.events ?? []) {
      if (event.scorer) goalCount[event.scorer] = (goalCount[event.scorer] ?? 0) + 1
      if (event.assister) assistCount[event.assister] = (assistCount[event.assister] ?? 0) + 1
    }
  }

  const getTopEntries = (countMap) => {
    if (Object.keys(countMap).length === 0) return []
    const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1])
    const topCount = sorted[0][1]
    return sorted
      .filter(([, count]) => count === topCount)
      .map(([id, count]) => ({ id, count, name: players.find((p) => p.id === id)?.name ?? id }))
  }

  return { topScorers: getTopEntries(goalCount), topAssisters: getTopEntries(assistCount) }
}

const LiveTournament = ({ adminMode }) => {
  const { activeLeagueId, leagues, players, tournaments, setLeagues, setPlayers, setTournaments } = useAppContext()
  const league = leagues.find((item) => item.id === activeLeagueId) ?? null
  const leaguePlayers = useMemo(
    () => players.filter((player) => player.leagueId === activeLeagueId),
    [activeLeagueId, players],
  )
  const leagueTournaments = useMemo(
    () => tournaments.filter((tournament) => tournament.leagueId === activeLeagueId),
    [activeLeagueId, tournaments],
  )
  const { selectedTournamentId, setSelectedTournamentId, selectedTournament, createTournament } =
    useTournamentEditor(leagueTournaments, leaguePlayers, league)
  const [editingGame, setEditingGame] = useState(null)
  const [teamBuilderMessage, setTeamBuilderMessage] = useState('')
  const [gameInputMessage, setGameInputMessage] = useState('')
  const [editingTournamentName, setEditingTournamentName] = useState(false)
  const [nameEditValue, setNameEditValue] = useState('')
  const [editingForTournamentId, setEditingForTournamentId] = useState(selectedTournamentId)

  if (editingForTournamentId !== selectedTournamentId) {
    setEditingForTournamentId(selectedTournamentId)
    setEditingTournamentName(false)
  }
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

  // Overall stats for share (combined template)
  const overallStats = useMemo(
    () => calculatePlayerStats(leaguePlayers, leagueTournaments, APP_CONFIG.points, league?.type),
    [leaguePlayers, leagueTournaments, league],
  )
  const overallLeaders = useMemo(() => getLeaders(overallStats), [overallStats])

  // Per-tournament top scorer / assister
  const tournamentTopStats = useMemo(() => {
    if (!selectedTournament || selectedTournament.games.length === 0) return null
    return getTournamentTopStats(selectedTournament.games, leaguePlayers)
  }, [selectedTournament, leaguePlayers])

  const sessionShareUrl = useMemo(
    () => (league && selectedTournament ? buildLeagueShareUrl(league.id, selectedTournament.id) : ''),
    [league, selectedTournament],
  )

  // Share messages
  const dayShareMsg = useMemo(() => {
    if (!selectedTournament || !league) return ''
    // Standings table in day share only for tournament mode; league standings go in the overall share only
    const dayStandings = league.type === LEAGUE_TYPES.tournament ? standings : []
    // Tournament mode: skip individual game results (only stats/standings matter)
    const includeResults = league.type !== LEAGUE_TYPES.tournament
    return generateDayShareMessage(selectedTournament, selectedTournament.teams, leaguePlayers, league.name, dayStandings, {
      includeResults,
      shareUrl: sessionShareUrl,
    })
  }, [selectedTournament, leaguePlayers, league, standings, sessionShareUrl])

  const teamsShareMsg = useMemo(() => {
    if (!selectedTournament || !league) return ''
    return generateTeamShareMessage(selectedTournament, leaguePlayers, league.name, league, sessionShareUrl)
  }, [selectedTournament, leaguePlayers, league, sessionShareUrl])

  const combinedShareMsg = useMemo(() => {
    if (!dayShareMsg) return ''
    // Only include team standings for regular leagues; tourney/friendly standings are per-session only
    const overallStandings = league?.type === LEAGUE_TYPES.regular ? standings : []
    const overallMsg = generateOverallShareMessage(
      overallStats,
      overallLeaders,
      overallStandings,
      league?.name ?? '',
      sessionShareUrl,
    )
    return generateCombinedShareMessage(dayShareMsg, overallMsg)
  }, [dayShareMsg, overallStats, overallLeaders, standings, league, sessionShareUrl])

  const updateSelectedTournament = (updater) => {
    setTournaments((current) =>
      current.map((item) => (item.id === selectedTournamentId ? { ...item, ...updater(item) } : item)),
    )
  }

  const updateSelectedTournamentMeta = (field, value) => {
    if (!adminMode || !selectedTournament) return
    updateSelectedTournament((tournament) => {
      if (field === 'name') {
        return {
          name: value,
          teams: applySessionCustomNameToTeams(tournament.teams, value),
        }
      }
      if (field === 'leagueNumber') {
        const nextLeagueNumber = Number.parseInt(value, 10)
        return { leagueNumber: Number.isNaN(nextLeagueNumber) ? tournament.leagueNumber : nextLeagueNumber }
      }
      if (field === 'date') {
        const nextDate = value || tournament.date
        return {
          date: nextDate,
          year: Number(nextDate.slice(0, 4)) || tournament.year,
        }
      }
      return { [field]: value }
    })
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
      current.map((item) =>
        item.leagueId === league.id
          ? {
              ...item,
              teams: applySessionCustomNameToTeams(
                nextTeams.map((team) => ({ ...team })),
                item.name,
              ),
            }
          : item,
      ),
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
    const max = getMaxPlayersPerTeam(league)

    if (teamId && targetTeam && targetTeam.players.length >= max && playerCurrentTeam?.id !== teamId) {
      setTeamBuilderMessage(`אי אפשר להוסיף יותר מ-${max} שחקנים לקבוצה.`)
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
        teams.map((team) => ({ ...team, players: team.players.filter((id) => id !== playerId) })),
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

  const handleRenamePlayer = (playerId, name) => {
    if (!adminMode) return
    setPlayers((current) => current.map((player) => (player.id === playerId ? { ...player, name } : player)))
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

  const handleAddPlayer = (name, teamId = null) => {
    if (!adminMode || !name.trim()) return
    const max = teamId ? getMaxPlayersPerTeam(league) : null
    if (teamId && max) {
      const targetTeams =
        league.type === LEAGUE_TYPES.regular ? league.teams ?? [] : selectedTournament?.teams ?? []
      const targetTeam = targetTeams.find((team) => team.id === teamId)
      if (targetTeam && targetTeam.players.length >= max) {
        setTeamBuilderMessage(`אי אפשר להוסיף יותר מ-${max} שחקנים לקבוצה.`)
        return
      }
    }
    setTeamBuilderMessage('')
    const nextPlayer = {
      id: `p${Date.now()}`,
      name: name.trim(),
      leagueId: activeLeagueId,
      isOffense: false,
      isDefense: false,
    }
    setPlayers((current) => [...current, nextPlayer])
    if (teamId) {
      const applyAssign = (teams) =>
        teams.map((team) =>
          team.id === teamId ? { ...team, players: [...team.players, nextPlayer.id] } : team,
        )
      if (league.type === LEAGUE_TYPES.regular) {
        syncRegularLeagueTeams(applyAssign)
      } else {
        updateSelectedTournament((tournament) => ({ teams: applyAssign(tournament.teams) }))
      }
    }
  }

  const handleSaveGame = (game) => {
    if (!adminMode || !selectedTournament || !league) return
    setGameInputMessage('')
    updateSelectedTournament((tournament) => {
      const exists = tournament.games.some((item) => item.id === game.id)
      if (exists) {
        return { games: tournament.games.map((item) => (item.id === game.id ? game : item)) }
      }
      // No game limit for now
      // const gameLimit = getSessionGamesLimit(league)
      // if (tournament.games.length >= gameLimit) {
      //   setGameInputMessage(labels.maxGamesMessage(gameLimit))
      //   return { games: tournament.games }
      // }
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

  const handleChangePlayerRank = (playerId, rank) => {
    if (!adminMode) return
    setPlayers((current) =>
      current.map((player) => (player.id === playerId ? { ...player, rank: rank ?? null } : player)),
    )
  }

  const handleAutoGenerate = () => {
    if (!adminMode || !league) return
    const currentTeams =
      league.type === LEAGUE_TYPES.regular ? league.teams ?? [] : selectedTournament?.teams ?? []
    if (!currentTeams.length) return
    const newTeams = generateBalancedTeams(leaguePlayers, currentTeams)
    if (league.type === LEAGUE_TYPES.regular) {
      syncRegularLeagueTeams(() => newTeams)
    } else {
      updateSelectedTournament(() => ({ teams: newTeams }))
    }
  }

  const handleCleanTeams = () => {
    if (!adminMode || !league) return
    const clearPlayers = (teams) => teams.map((team) => ({ ...team, players: [] }))
    if (league.type === LEAGUE_TYPES.regular) {
      syncRegularLeagueTeams(clearPlayers)
      return
    }
    updateSelectedTournament((tournament) => ({ teams: clearPlayers(tournament.teams) }))
  }

  const handleBulkMoveAll = (assignments) => {
    if (!adminMode || !league) return
    setTeamBuilderMessage('')
    const applyUpdate = (teams) => {
      const affectedIds = new Set(assignments.map((a) => a.playerId))
      let updated = teams.map((team) => ({
        ...team,
        players: team.players.filter((id) => !affectedIds.has(id)),
      }))
      for (const { playerId, teamId } of assignments) {
        if (teamId) {
          updated = updated.map((team) =>
            team.id === teamId ? { ...team, players: [...team.players, playerId] } : team,
          )
        }
      }
      return updated
    }
    if (league.type === LEAGUE_TYPES.regular) {
      syncRegularLeagueTeams(applyUpdate)
    } else {
      updateSelectedTournament((tournament) => ({ teams: applyUpdate(tournament.teams) }))
    }
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

  const handleDeleteTournament = () => {
    if (!adminMode || !selectedTournament) return
    if (!window.confirm(`למחוק את ${labels.selectLabel} ${selectedTournament.leagueNumber ?? ''}? פעולה זו אינה הפיכה.`)) return
    const remaining = leagueTournaments.filter((t) => t.id !== selectedTournamentId)
    setTournaments((current) => current.filter((t) => t.id !== selectedTournamentId))
    setSelectedTournamentId(remaining[remaining.length - 1]?.id ?? null)
  }

  const handleRemoveFriendlyTeam = (teamId) => {
    if (!adminMode || !league || league.type !== LEAGUE_TYPES.friendly || !selectedTournament) return
    if ((selectedTournament.teams?.length ?? 0) <= 2) {
      setTeamBuilderMessage('חייב להיות לפחות 2 קבוצות.')
      return
    }
    setTeamBuilderMessage('')
    updateSelectedTournament((tournament) => ({
      teams: tournament.teams.filter((team) => team.id !== teamId),
    }))
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
          color:
            APP_CONFIG.allowedTeamColors[tournament.teams.length % APP_CONFIG.allowedTeamColors.length] ?? 'gray',
          players: [],
        },
      ],
    }))
  }

  if (!league) return null

  if (!selectedTournament) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p>{labels.empty}</p>
        <button
          onClick={handleCreateTournament}
          data-testid="create-tournament-empty"
          className="mt-3 min-h-[48px] rounded-xl bg-green-600 px-6 py-3 text-white"
        >
          {labels.create}
        </button>
      </div>
    )
  }

  const undoButton = (
    <button
      onClick={handleUndoLastGame}
      disabled={!adminMode || selectedTournament.games.length === 0}
      data-testid="undo-last-game"
      className="min-h-[40px] rounded-xl border px-3 py-1.5 text-sm disabled:opacity-30"
    >
      ↩
    </button>
  )

  return (
    <div className="space-y-3">
      {/* Round / game-day row */}
      <div className="rounded-2xl bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-gray-700">{labels.liveTitle}</h2>
        <div className="flex items-center gap-2">
          <select
            value={selectedTournamentId}
            onChange={(e) => setSelectedTournamentId(e.target.value)}
            data-testid="tournament-select"
            className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm"
          >
            {leagueTournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {league.name} {getSessionDisplayName(tournament, league)} / {tournament.year ?? '-'} - {tournament.date}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreateTournament}
            disabled={!adminMode}
            data-testid="create-tournament"
            className="shrink-0 min-h-[44px] rounded-xl bg-green-600 px-4 py-2.5 text-sm text-white disabled:opacity-40"
          >
            {labels.createAnother}
          </button>
          <button
            onClick={handleDeleteTournament}
            disabled={!adminMode}
            data-testid="delete-tournament"
            className="shrink-0 min-h-[44px] rounded-xl bg-red-600 px-4 py-2.5 text-sm text-white disabled:opacity-40"
          >
            מחק יום
          </button>
        </div>

        {/* Session name with pencil edit — admin only */}
        {adminMode ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              {editingTournamentName ? (
                <input
                  autoFocus
                  value={nameEditValue}
                  onChange={(event) => setNameEditValue(event.target.value)}
                  onBlur={() => {
                    updateSelectedTournamentMeta('name', nameEditValue)
                    setEditingTournamentName(false)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === 'Escape') {
                      updateSelectedTournamentMeta('name', nameEditValue)
                      setEditingTournamentName(false)
                    }
                  }}
                  data-testid="tournament-name-input"
                  className="flex-1 rounded-xl border px-3 py-2 text-sm"
                />
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-700">{getSessionDisplayName(selectedTournament, league)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const defaultName =
                        selectedTournament.name ||
                        `${getSessionDisplayName(selectedTournament, league)} / ${selectedTournament.date ?? ''}`
                      setNameEditValue(defaultName)
                      setEditingTournamentName(true)
                    }}
                    data-testid="tournament-name-edit-pencil"
                    className="shrink-0 rounded-lg px-2 py-1 text-base text-gray-400 hover:text-gray-600"
                  >
                    ✏️
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-gray-500">📅 תאריך</label>
              <input
                type="date"
                value={selectedTournament.date ?? ''}
                onChange={(event) => updateSelectedTournamentMeta('date', event.target.value)}
                data-testid="tournament-date-input"
                className="rounded-xl border px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : null}

        {/* Share buttons for this day */}
        {selectedTournament.games.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <ShareButton message={dayShareMsg} label="שתף תוצאות היום" name="day" />
            <ShareButton message={combinedShareMsg} label="שתף יום + סטט׳ ליגה" name="combined" />
          </div>
        ) : null}
      </div>

      {/* Game input */}
      <GameInput
        key={editingGame?.id ?? `${selectedTournament.id}-new-game`}
        teams={selectedTournament.teams}
        players={leaguePlayers}
        disabled={!adminMode}
        onSave={handleSaveGame}
        editingGame={editingGame}
        onCancelEdit={() => setEditingGame(null)}
        message={gameInputMessage}
        persistKey={selectedTournament.id}
      />

      {/* Live standings */}
      {league.type !== LEAGUE_TYPES.friendly ? (
        <ScoreBoard
          standings={standings}
          title={league.type === LEAGUE_TYPES.regular ? 'טבלת ליגה כוללת' : 'טבלת מצב חיה'}
          showGoals={league.type === LEAGUE_TYPES.regular}
        />
      ) : null}

      {/* Teams — collapsible drawer */}
      {league.type === LEAGUE_TYPES.regular ? (
        <CollapsibleSection
          title="הגדרת קבוצות"
          headerExtra={
            <div className="flex items-center gap-2">
              <ShareButton message={teamsShareMsg} label="שתף סגלים" name="teams" />
              <label className="flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-xs">
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
                <span>עריכת סגל</span>
              </label>
              <button
                onClick={handleAddRegularTeam}
                disabled={!adminMode || !isRegularSetupEditable}
                data-testid="add-regular-team"
                className="min-h-[36px] rounded-xl border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                + קבוצה
              </button>
            </div>
          }
        >
          {teamBuilderMessage ? (
            <p data-testid="team-builder-message" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {teamBuilderMessage}
            </p>
          ) : null}
          <TeamBuilder
            teams={selectedTournament?.teams ?? []}
            players={leaguePlayers}
            maxPlayersPerTeam={maxPlayersPerTeam}
            disabled={!adminMode || !isRegularSetupEditable}
            adminMode={adminMode}
            onMovePlayer={handleMovePlayer}
            onBulkMoveAll={handleBulkMoveAll}
            onChangeTeamColor={() => {}}
            onChangeTeamName={handleChangeTeamName}
            onChangePlayerRank={handleChangePlayerRank}
            onTogglePlayerRole={handleTogglePlayerRole}
            onDeletePlayer={handleDeletePlayer}
            onRenamePlayer={handleRenamePlayer}
            onAddPlayer={handleAddPlayer}
            onCleanTeams={handleCleanTeams}
            onAutoGenerate={handleAutoGenerate}
            allowColorEdit={false}
            allowNameEdit={isRegularSetupEditable}
            allowPlayerNameEdit={adminMode}
          />
        </CollapsibleSection>
      ) : league.type === LEAGUE_TYPES.friendly ? (
        <CollapsibleSection
          title="בניית קבוצות ידידות"
          headerExtra={
            <div className="flex items-center gap-2">
              <ShareButton message={teamsShareMsg} label="שתף סגלים" name="teams" />
              <button
                onClick={handleAddFriendlyTeam}
                disabled={!adminMode}
                data-testid="add-friendly-team"
                className="min-h-[36px] rounded-xl border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                + קבוצה
              </button>
            </div>
          }
        >
          {teamBuilderMessage ? (
            <p data-testid="team-builder-message" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {teamBuilderMessage}
            </p>
          ) : null}
          <TeamBuilder
            teams={selectedTournament?.teams ?? []}
            players={leaguePlayers}
            maxPlayersPerTeam={maxPlayersPerTeam}
            disabled={!adminMode}
            adminMode={adminMode}
            onMovePlayer={handleMovePlayer}
            onBulkMoveAll={handleBulkMoveAll}
            onChangeTeamColor={handleChangeTeamColor}
            onChangePlayerRank={handleChangePlayerRank}
            onTogglePlayerRole={handleTogglePlayerRole}
            onDeletePlayer={handleDeletePlayer}
            onRenamePlayer={handleRenamePlayer}
            onAddPlayer={handleAddPlayer}
            onCleanTeams={handleCleanTeams}
            onAutoGenerate={handleAutoGenerate}
            onRemoveTeam={handleRemoveFriendlyTeam}
            allowPlayerNameEdit={adminMode}
          />
        </CollapsibleSection>
      ) : (
        <CollapsibleSection title="בניית קבוצות" headerExtra={<ShareButton message={teamsShareMsg} label="שתף סגלים" name="teams" />}>
          {teamBuilderMessage ? (
            <p data-testid="team-builder-message" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {teamBuilderMessage}
            </p>
          ) : null}
          <TeamBuilder
            teams={selectedTournament?.teams ?? []}
            players={leaguePlayers}
            maxPlayersPerTeam={maxPlayersPerTeam}
            disabled={!adminMode}
            adminMode={adminMode}
            onMovePlayer={handleMovePlayer}
            onBulkMoveAll={handleBulkMoveAll}
            onChangeTeamColor={handleChangeTeamColor}
            onChangePlayerRank={handleChangePlayerRank}
            onTogglePlayerRole={handleTogglePlayerRole}
            onDeletePlayer={handleDeletePlayer}
            onRenamePlayer={handleRenamePlayer}
            onAddPlayer={handleAddPlayer}
            onCleanTeams={handleCleanTeams}
            onAutoGenerate={handleAutoGenerate}
            allowPlayerNameEdit={adminMode}
          />
        </CollapsibleSection>
      )}

      {/* Previous games — collapsible drawer */}
      <CollapsibleSection
        title={`משחקים ב${getSessionLabel(league)} (${selectedTournament.games.length})`}
        headerExtra={undoButton}
      >
        <TournamentTable
          league={league}
          games={selectedTournament.games}
          teams={selectedTournament.teams}
          readOnly={!adminMode}
          onEdit={setEditingGame}
          onDelete={handleDeleteGame}
        />
      </CollapsibleSection>

      {/* Per-session top scorer / assister */}
      {tournamentTopStats && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-bold text-gray-700">
            ראשי קטגוריות – {getSessionDisplayName(selectedTournament, league)}
          </h3>
          <div className="flex flex-wrap gap-4 text-sm">
            {tournamentTopStats.topScorers.length > 0 && (
              <div>
                ⚽ כובש:{' '}
                <strong>{tournamentTopStats.topScorers.map((p) => p.name).join(' / ')}</strong>{' '}
                <span className="text-gray-500">({tournamentTopStats.topScorers[0].count})</span>
              </div>
            )}
            {tournamentTopStats.topAssisters.length > 0 && (
              <div>
                🎯 מבשל:{' '}
                <strong>{tournamentTopStats.topAssisters.map((p) => p.name).join(' / ')}</strong>{' '}
                <span className="text-gray-500">({tournamentTopStats.topAssisters[0].count})</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

export default LiveTournament
