import { useMemo, useState } from 'react'
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
      <div className="flex min-w-0 items-center gap-1">
        {isBench && onDeletePlayer ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDeletePlayer(player.id)}
            className="min-h-[36px] min-w-[36px] shrink-0 rounded-md bg-red-100 px-2 py-1 text-xs text-red-700"
            data-testid={`player-delete-${player.id}`}
          >
            ✕
          </button>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{player.name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onTogglePlayerRole(player.id, 'isOffense')}
          className={`min-h-[36px] min-w-[36px] rounded-md px-2 py-1 text-xs ${player.isOffense ? 'bg-emerald-100' : 'bg-gray-100'}`}
          data-testid={`player-offense-${player.id}`}
        >
          ⚔
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onTogglePlayerRole(player.id, 'isDefense')}
          className={`min-h-[36px] min-w-[36px] rounded-md px-2 py-1 text-xs ${player.isDefense ? 'bg-sky-100' : 'bg-gray-100'}`}
          data-testid={`player-defense-${player.id}`}
        >
          🛡
        </button>
      </div>
    </div>
  </div>
)

const BenchAddRow = ({ onAddPlayer }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const handleAdd = () => {
    if (!name.trim()) return
    onAddPlayer(name.trim(), null)
    setName('')
    setIsOpen(false)
  }
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-2 min-h-[40px] w-full rounded-xl border border-dashed py-2 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600"
        data-testid="bench-add-player-toggle"
      >
        +
      </button>
    )
  }
  return (
    <div className="mt-2 flex gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd()
          if (e.key === 'Escape') setIsOpen(false)
        }}
        data-testid="new-player-input"
        placeholder="הקלד שם שחקן חדש"
        className="min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-sm"
      />
      <button
        onClick={handleAdd}
        disabled={!name.trim()}
        data-testid="add-player-button"
        className={`min-h-[44px] rounded-xl px-4 py-2 text-sm text-white transition-colors ${name.trim() ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300'}`}
      >
        +
      </button>
    </div>
  )
}

const TeamAddRow = ({ team, onAddPlayer }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const handleAdd = () => {
    if (!name.trim()) return
    onAddPlayer(name.trim(), team.id)
    setName('')
    setIsOpen(false)
  }
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-2 min-h-[40px] w-full rounded-xl border border-dashed py-2 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600"
        data-testid={`team-add-player-toggle-${team.id}`}
      >
        +
      </button>
    )
  }
  return (
    <div className="mt-2 flex gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd()
          if (e.key === 'Escape') setIsOpen(false)
        }}
        data-testid={`team-player-input-${team.id}`}
        placeholder="שם שחקן"
        className="min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-sm"
      />
      <button
        onClick={handleAdd}
        disabled={!name.trim()}
        data-testid={`team-add-player-button-${team.id}`}
        className={`min-h-[44px] rounded-xl px-3 py-2 text-sm text-white transition-colors ${name.trim() ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300'}`}
      >
        +
      </button>
    </div>
  )
}

const TeamColumn = ({
  title,
  team,
  players,
  maxPlayersPerTeam,
  disabled,
  adminMode,
  onChangeTeamColor,
  onChangeTeamName,
  onDropPlayer,
  onTogglePlayerRole,
  onDeletePlayer,
  onAddPlayer,
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
    className={`rounded-xl border p-3 ${isBench ? 'bg-white' : (colorClass[team.color] ?? 'bg-gray-50 border-gray-300')}`}
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
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${players.length >= maxPlayersPerTeam ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}
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
    {/* Inline add player */}
    {adminMode && isBench ? <BenchAddRow onAddPlayer={onAddPlayer} /> : null}
    {adminMode && !isBench && team ? <TeamAddRow team={team} onAddPlayer={onAddPlayer} /> : null}
  </div>
)

const TeamBuilder = ({
  teams,
  players,
  maxPlayersPerTeam,
  disabled,
  adminMode,
  onMovePlayer,
  onChangeTeamColor,
  onChangeTeamName,
  onTogglePlayerRole,
  onDeletePlayer,
  onAddPlayer,
  allowColorEdit = true,
  allowNameEdit = false,
}) => {
  const playersByTeamId = useMemo(() => {
    const map = new Map()
    teams.forEach((team) => {
      map.set(
        team.id,
        team.players.map((playerId) => players.find((player) => player.id === playerId)).filter(Boolean),
      )
    })
    return map
  }, [players, teams])

  const assignedPlayerIds = new Set(teams.flatMap((team) => team.players))
  const benchPlayers = players.filter((player) => !assignedPlayerIds.has(player.id))

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <TeamColumn
        title="שחקנים פנויים"
        players={benchPlayers}
        disabled={disabled}
        adminMode={adminMode}
        onDropPlayer={onMovePlayer}
        onTogglePlayerRole={onTogglePlayerRole}
        onDeletePlayer={onDeletePlayer}
        onAddPlayer={onAddPlayer ?? (() => {})}
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
          adminMode={adminMode}
          onChangeTeamColor={onChangeTeamColor}
          onChangeTeamName={onChangeTeamName}
          onDropPlayer={onMovePlayer}
          onTogglePlayerRole={onTogglePlayerRole}
          onAddPlayer={onAddPlayer ?? (() => {})}
          allowColorEdit={allowColorEdit}
          allowNameEdit={allowNameEdit}
        />
      ))}
    </div>
  )
}

export default TeamBuilder
