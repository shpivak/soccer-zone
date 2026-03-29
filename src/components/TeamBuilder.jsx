import { useMemo } from 'react'
import { APP_CONFIG } from '../config'
import { getTeamDisplayName } from '../utils/leagueUtils'

const colorLabel = {
  black: 'שחור',
  yellow: 'צהוב',
  pink: 'ורוד',
  orange: 'כתום',
  blue: 'כחול',
  gray: 'אפור',
  white: 'לבן',
}

const colorClass = {
  black: 'bg-gray-200 border-gray-500',
  yellow: 'bg-yellow-50 border-yellow-300',
  pink: 'bg-pink-50 border-pink-300',
  orange: 'bg-orange-50 border-orange-300',
  blue: 'bg-blue-50 border-blue-300',
  gray: 'bg-gray-50 border-gray-300',
  white: 'bg-white border-gray-300',
}

const PlayerChip = ({ player, sourceTeamId, disabled, onTogglePlayerRole, onDeletePlayer, isBench }) => (
  <div
    draggable={!disabled}
    onDragStart={(event) => {
      event.dataTransfer.setData('text/plain', JSON.stringify({ playerId: player.id, sourceTeamId }))
      event.dataTransfer.effectAllowed = 'move'
    }}
    className="rounded-xl border bg-white p-2 text-sm shadow-sm"
    data-testid={`player-chip-${player.id}`}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1 min-w-0">
        {isBench && onDeletePlayer ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDeletePlayer(player.id)}
            className="rounded-md px-2 py-1 text-xs bg-red-100 text-red-700 shrink-0"
            data-testid={`player-delete-${player.id}`}
          >
            ✕
          </button>
        ) : null}
        <span className="truncate">{player.name}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onTogglePlayerRole(player.id, 'isOffense')}
          className={`rounded-md px-2 py-1 text-xs ${player.isOffense ? 'bg-emerald-100' : 'bg-gray-100'}`}
          data-testid={`player-offense-${player.id}`}
        >
          ⚔
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onTogglePlayerRole(player.id, 'isDefense')}
          className={`rounded-md px-2 py-1 text-xs ${player.isDefense ? 'bg-sky-100' : 'bg-gray-100'}`}
          data-testid={`player-defense-${player.id}`}
        >
          🛡
        </button>
      </div>
    </div>
  </div>
)

const TeamColumn = ({
  title,
  team,
  players,
  maxPlayersPerTeam,
  disabled,
  onChangeTeamColor,
  onChangeTeamName,
  onDropPlayer,
  onTogglePlayerRole,
  onDeletePlayer,
  allowColorEdit,
  allowNameEdit,
  isBench = false,
}) => (
  <div
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => {
      event.preventDefault()
      const raw = event.dataTransfer.getData('text/plain')
      if (!raw) return
      const payload = JSON.parse(raw)
      onDropPlayer(payload.playerId, team?.id ?? null)
    }}
    className={`rounded-xl border p-3 ${isBench ? 'bg-white' : colorClass[team.color] ?? 'bg-gray-50 border-gray-300'}`}
    data-testid={team ? `team-card-${team.id}` : 'team-card-bench'}
  >
    <div className="mb-3 flex items-center justify-between gap-2">
      {allowNameEdit && team ? (
        <input
          value={team.name ?? ''}
          disabled={disabled}
          onChange={(event) => onChangeTeamName(team.id, event.target.value)}
          data-testid={`team-name-input-${team.id}`}
          placeholder="שם קבוצה"
          className="min-w-0 flex-1 rounded-lg border bg-white p-2 text-sm"
        />
      ) : (
        <h3 className="font-semibold">{title}</h3>
      )}
      {!isBench && team && maxPlayersPerTeam ? (
        <span
          data-testid={`team-player-count-${team.id}`}
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${players.length >= maxPlayersPerTeam ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}
        >
          {players.length}/{maxPlayersPerTeam}
        </span>
      ) : null}
      {allowColorEdit && team ? (
        <select
          value={team.color}
          disabled={disabled}
          onChange={(event) => onChangeTeamColor(team.id, event.target.value)}
          data-testid={`team-color-select-${team.id}`}
          className="rounded-lg border bg-white p-2 text-sm"
        >
          {APP_CONFIG.allowedTeamColors.map((color) => (
            <option key={color} value={color}>
              {colorLabel[color] ?? color}
            </option>
          ))}
        </select>
      ) : null}
    </div>
    <div className="space-y-2">
      {players.map((player) => (
        <PlayerChip
          key={player.id}
          player={player}
          sourceTeamId={team?.id ?? null}
          disabled={disabled}
          onTogglePlayerRole={onTogglePlayerRole}
          onDeletePlayer={onDeletePlayer}
          isBench={isBench}
        />
      ))}
      {players.length === 0 ? <p className="text-xs text-gray-500">גרור לכאן שחקנים</p> : null}
    </div>
  </div>
)

const TeamBuilder = ({
  teams,
  players,
  maxPlayersPerTeam,
  disabled,
  onMovePlayer,
  onChangeTeamColor,
  onChangeTeamName,
  onTogglePlayerRole,
  onDeletePlayer,
  message,
  allowColorEdit = true,
  allowNameEdit = false,
}) => {
  const playersByTeamId = useMemo(() => {
    const map = new Map()
    teams.forEach((team) => {
      map.set(
        team.id,
        team.players
          .map((playerId) => players.find((player) => player.id === playerId))
          .filter(Boolean),
      )
    })
    return map
  }, [players, teams])

  const assignedPlayerIds = new Set(teams.flatMap((team) => team.players))
  const benchPlayers = players.filter((player) => !assignedPlayerIds.has(player.id))

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">בניית קבוצות</h2>
      {message ? (
        <p data-testid="team-builder-message" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <TeamColumn
          title="שחקנים פנויים"
          players={benchPlayers}
          disabled={disabled}
          onDropPlayer={onMovePlayer}
          onTogglePlayerRole={onTogglePlayerRole}
          onDeletePlayer={onDeletePlayer}
          allowColorEdit={false}
          allowNameEdit={false}
          isBench
        />
        {teams.map((team) => (
          <TeamColumn
            key={team.id}
            title={getTeamDisplayName(team)}
            team={team}
            players={playersByTeamId.get(team.id) ?? []}
            maxPlayersPerTeam={maxPlayersPerTeam}
            disabled={disabled}
            onChangeTeamColor={onChangeTeamColor}
            onChangeTeamName={onChangeTeamName}
            onDropPlayer={onMovePlayer}
            onTogglePlayerRole={onTogglePlayerRole}
            allowColorEdit={allowColorEdit}
            allowNameEdit={allowNameEdit}
          />
        ))}
      </div>
    </section>
  )
}

export default TeamBuilder
