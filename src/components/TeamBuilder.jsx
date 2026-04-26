import { useMemo, useState } from 'react'
import { APP_CONFIG } from '../config'
import { getTeamDisplayName } from '../utils/leagueUtils'
import { generateBalancedTeams } from '../utils/teamGenerator'

const colorLabel = {
  black: 'שחור',
  yellow: 'צהוב',
  pink: 'ורוד',
  orange: 'כתום',
  blue: 'כחול',
  red: 'אדום',
  gray: 'אפור',
  white: 'לבן',
}

const colorClass = {
  black: 'bg-gray-200 border-gray-500',
  yellow: 'bg-yellow-50 border-yellow-300',
  pink: 'bg-pink-50 border-pink-300',
  orange: 'bg-orange-50 border-orange-300',
  blue: 'bg-blue-50 border-blue-300',
  red: 'bg-red-50 border-red-300',
  gray: 'bg-gray-50 border-gray-300',
  white: 'bg-white border-gray-300',
}

// Cycle order: B (default) → A → C → B
const RANKS = ['B', 'A', 'C']

const SORT_MODES = ['none', 'rank', 'role']
const sortModeLabel = { none: 'מיין שחקנים ↕', rank: 'A→C', role: '⚔→🛡' }

const rankSortOrder = { A: 0, B: 1, C: 2 }
const roleSortOrder = (p) => {
  if (p.isOffense && !p.isDefense) return 0
  if (p.isOffense && p.isDefense) return 1
  if (!p.isOffense && p.isDefense) return 2
  return 3
}

const rankClass = {
  A: 'bg-amber-100 text-amber-800',
  B: 'bg-sky-100 text-sky-800',
  C: 'bg-gray-100 text-gray-600',
}

// Team assignment cycling button — mirrors colorClass exactly, adds text color
const teamBtnColorClass = {
  black: 'bg-gray-200 border-gray-500 text-gray-800',
  yellow: 'bg-yellow-50 border-yellow-300 text-yellow-900',
  pink: 'bg-pink-50 border-pink-300 text-pink-900',
  orange: 'bg-orange-50 border-orange-300 text-orange-900',
  blue: 'bg-blue-50 border-blue-300 text-blue-900',
  red: 'bg-red-50 border-red-300 text-red-900',
  gray: 'bg-gray-50 border-gray-300 text-gray-700',
  white: 'bg-white border-gray-300 text-gray-700',
}

const computeAssignments = (teams, players) => {
  const map = new Map()
  players.forEach((p) => map.set(p.id, null))
  teams.forEach((team) => {
    team.players.forEach((playerId) => {
      if (map.has(playerId)) map.set(playerId, team.id)
    })
  })
  return map
}

const PlayerChip = ({
  player,
  sourceTeamId,
  disabled,
  adminMode,
  onTogglePlayerRole,
  onChangePlayerRank,
  onDeletePlayer,
  onRenamePlayer,
  allowNameEdit,
  isBench,
}) => {
  const currentRank = player.rank ?? 'B'

  const cycleRank = () => {
    const idx = RANKS.indexOf(currentRank)
    const next = RANKS[(idx + 1) % RANKS.length]
    onChangePlayerRank?.(player.id, next)
  }

  return (
    <div
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', JSON.stringify({ playerId: player.id, sourceTeamId }))
        event.dataTransfer.effectAllowed = 'move'
      }}
      className="w-full overflow-hidden rounded-xl border bg-white p-2 text-sm shadow-sm"
      data-testid={`player-chip-${player.id}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-1">
        <div className="flex min-w-0 flex-1 items-center gap-1">
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
          {allowNameEdit ? (
            <>
              <span className="sr-only">{player.name}</span>
              <input
                value={player.name}
                disabled={!onRenamePlayer}
                onChange={(event) => onRenamePlayer?.(player.id, event.target.value)}
                className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
                data-testid={`player-name-input-${player.id}`}
              />
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate leading-tight">{player.name}</span>
          )}
        </div>
        {/* Admin-only: rank cycle button + role toggles */}
        {adminMode ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={cycleRank}
              className={`min-h-[32px] min-w-[28px] rounded-md px-1.5 py-1 text-xs font-bold ${rankClass[currentRank] ?? 'bg-gray-100 text-gray-600'}`}
              data-testid={`player-rank-${player.id}`}
              title="דירוג שחקן (A/B/C)"
            >
              {currentRank}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onTogglePlayerRole(player.id, 'isOffense')}
              className={`min-h-[32px] min-w-[32px] rounded-md px-1.5 py-1 text-xs ${player.isOffense ? 'bg-emerald-100' : 'bg-gray-100'}`}
              data-testid={`player-offense-${player.id}`}
            >
              ⚔
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onTogglePlayerRole(player.id, 'isDefense')}
              className={`min-h-[32px] min-w-[32px] rounded-md px-1.5 py-1 text-xs ${player.isDefense ? 'bg-sky-100' : 'bg-gray-100'}`}
              data-testid={`player-defense-${player.id}`}
            >
              🛡
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

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
  onChangePlayerRank,
  onDeletePlayer,
  onRenamePlayer,
  onAddPlayer,
  onCleanTeams,
  onAutoGenerate,
  onRemoveTeam,
  allowColorEdit,
  allowNameEdit,
  allowPlayerNameEdit,
  isCollapsed,
  onToggleCollapse,
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
      {/* Collapse toggle */}
      {onToggleCollapse ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="shrink-0 px-1 text-sm text-gray-400 hover:text-gray-700"
          data-testid={isBench ? 'bench-collapse-toggle' : `team-collapse-toggle-${team?.id}`}
          title={isCollapsed ? 'פתח' : 'כווץ'}
        >
          {isBench
            ? isCollapsed ? '◀' : '▶'
            : isCollapsed ? '▶' : '▼'}
        </button>
      ) : null}

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
        <h3 className="min-w-0 flex-1 truncate font-semibold">{title}</h3>
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

      {/* Remove team button — non-bench, admin only, when handler provided */}
      {!isBench && adminMode && onRemoveTeam && team ? (
        <button
          type="button"
          onClick={() => onRemoveTeam(team.id)}
          disabled={disabled}
          data-testid={`remove-team-${team.id}`}
          className="min-h-[32px] shrink-0 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-40"
          title="הסר קבוצה"
        >
          ✕
        </button>
      ) : null}

      {/* Clean + auto-generate buttons — bench only, admin only */}
      {isBench && adminMode ? (
        <div className="flex shrink-0 gap-1">
          {onAutoGenerate ? (
            <button
              type="button"
              onClick={onAutoGenerate}
              disabled={disabled}
              data-testid="auto-generate-teams-button"
              className="min-h-[32px] rounded-lg border border-violet-300 bg-violet-50 px-2 py-1 text-xs text-violet-700 hover:bg-violet-100 disabled:opacity-40"
              title="חלק שחקנים אוטומטית לקבוצות מאוזנות"
            >
              ✨
            </button>
          ) : null}
          {onCleanTeams ? (
            <button
              type="button"
              onClick={onCleanTeams}
              disabled={disabled}
              data-testid="clean-teams-button"
              className="min-h-[32px] rounded-lg border border-orange-300 bg-orange-50 px-2 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-40"
              title="החזר את כל השחקנים לספסל"
            >
              נקה
            </button>
          ) : null}
        </div>
      ) : null}
    </div>

    {/* Players list — hidden when collapsed */}
    {!isCollapsed ? (
      <>
        <div className="space-y-2">
          {players.map((player) => (
            <PlayerChip
              key={player.id}
              player={player}
              sourceTeamId={team?.id ?? null}
              disabled={disabled}
              adminMode={adminMode}
              onTogglePlayerRole={onTogglePlayerRole}
              onChangePlayerRank={onChangePlayerRank}
              onDeletePlayer={onDeletePlayer}
              onRenamePlayer={onRenamePlayer}
              allowNameEdit={allowPlayerNameEdit}
              isBench={isBench}
            />
          ))}
          {players.length === 0 ? <p className="text-xs text-gray-500">גרור לכאן שחקנים</p> : null}
        </div>
        {/* Inline add player */}
        {adminMode && isBench ? <BenchAddRow onAddPlayer={onAddPlayer} /> : null}
        {adminMode && !isBench && team ? <TeamAddRow team={team} onAddPlayer={onAddPlayer} /> : null}
      </>
    ) : (
      <p className="text-xs text-gray-400">{players.length} שחקנים</p>
    )}
  </div>
)

// Selecting mode: flat player list with inline team-cycling buttons
const SelectingView = ({
  teams,
  players,
  maxPlayersPerTeam,
  disabled,
  adminMode,
  onBulkMoveAll,
  onAddPlayer,
  onDeletePlayer,
  onChangePlayerRank,
  onTogglePlayerRole,
  onRemoveTeam,
}) => {
  const [pendingAssignments, setPendingAssignments] = useState(() => computeAssignments(teams, players))
  const [hasChanges, setHasChanges] = useState(false)
  const [sortMode, setSortMode] = useState('none')

  const getEffectiveTeamId = (playerId) => pendingAssignments.get(playerId) ?? null

  const cycleSortMode = () => {
    const idx = SORT_MODES.indexOf(sortMode)
    setSortMode(SORT_MODES[(idx + 1) % SORT_MODES.length])
  }

  const sortedPlayers = useMemo(() => {
    if (sortMode === 'rank') {
      return [...players].sort((a, b) => (rankSortOrder[a.rank ?? 'B'] ?? 1) - (rankSortOrder[b.rank ?? 'B'] ?? 1))
    }
    if (sortMode === 'role') {
      return [...players].sort((a, b) => roleSortOrder(a) - roleSortOrder(b))
    }
    return players
  }, [players, sortMode])

  const setTeamForPlayer = (playerId, teamId) => {
    setPendingAssignments((prev) => new Map(prev).set(playerId, teamId || null))
    setHasChanges(true)
  }

  const handleAutoGenerate = () => {
    const newTeams = generateBalancedTeams(players, teams)
    setPendingAssignments(computeAssignments(newTeams, players))
    setHasChanges(true)
  }

  const handleClean = () => {
    setPendingAssignments(computeAssignments(teams.map((t) => ({ ...t, players: [] })), players))
    setHasChanges(true)
  }

  const pendingCountByTeam = useMemo(() => {
    const counts = new Map(teams.map((t) => [t.id, 0]))
    players.forEach((p) => {
      const teamId = getEffectiveTeamId(p.id)
      if (teamId) counts.set(teamId, (counts.get(teamId) ?? 0) + 1)
    })
    return counts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAssignments, teams, players])

  const benchCount = players.filter((p) => !getEffectiveTeamId(p.id)).length

  const handleSave = () => {
    const assignments = players.map((p) => ({
      playerId: p.id,
      teamId: getEffectiveTeamId(p.id),
    }))
    onBulkMoveAll(assignments)
    setHasChanges(false)
  }

  const currentRankOf = (player) => player.rank ?? 'B'

  return (
    <div className="space-y-3">
      {/* Top action row: utility buttons + save */}
      {adminMode ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoGenerate}
            disabled={disabled}
            data-testid="auto-generate-teams-button-top"
            className="min-h-[36px] rounded-lg border border-violet-300 bg-violet-50 px-3 py-1 text-xs text-violet-700 hover:bg-violet-100 disabled:opacity-40"
            title="חלק שחקנים אוטומטית לקבוצות מאוזנות"
          >
            ✨ אוטו
          </button>
          <button
            type="button"
            onClick={handleClean}
            disabled={disabled}
            data-testid="clean-teams-button-top"
            className="min-h-[36px] rounded-lg border border-orange-300 bg-orange-50 px-3 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-40"
            title="החזר את כל השחקנים לספסל"
          >
            נקה
          </button>
          <button
            type="button"
            onClick={cycleSortMode}
            className={`min-h-[36px] rounded-lg border px-3 py-1 text-xs transition-colors ${
              sortMode !== 'none'
                ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
            title="מיין שחקנים"
          >
            {sortModeLabel[sortMode]}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || !hasChanges}
            data-testid="selecting-mode-save-top"
            className={`min-h-[36px] rounded-xl px-4 py-1.5 text-sm font-semibold text-white transition-all disabled:opacity-40 ${
              hasChanges
                ? 'bg-green-500 shadow-md ring-2 ring-green-400 ring-offset-1 hover:bg-green-600'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            שמור
          </button>
        </div>
      ) : null}

      {/* Team summary cards — collapsed view */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {teams.map((team) => {
          const count = pendingCountByTeam.get(team.id) ?? 0
          const overMax = maxPlayersPerTeam && count >= maxPlayersPerTeam
          return (
            <div
              key={team.id}
              className={`rounded-xl border p-2 ${colorClass[team.color] ?? 'bg-gray-50 border-gray-300'}`}
              data-testid={`team-card-${team.id}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="min-w-0 truncate text-sm font-semibold">{getTeamDisplayName(team)}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${overMax ? 'bg-red-100 text-red-700' : 'bg-white/70 text-gray-600'}`}
                  data-testid={`team-player-count-${team.id}`}
                >
                  {count}{maxPlayersPerTeam ? `/${maxPlayersPerTeam}` : ''}
                </span>
                {adminMode && onRemoveTeam ? (
                  <button
                    type="button"
                    onClick={() => onRemoveTeam(team.id)}
                    disabled={disabled || teams.length <= APP_CONFIG.minTeams}
                    title={teams.length <= APP_CONFIG.minTeams ? `מינימום ${APP_CONFIG.minTeams} קבוצות` : 'הסר קבוצה'}
                    data-testid={`remove-team-${team.id}`}
                    className="min-h-[22px] min-w-[22px] shrink-0 rounded-md bg-red-50 px-1 py-0.5 text-xs text-red-600 hover:bg-red-100 disabled:opacity-40"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
        {/* Bench summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-2">
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-semibold text-gray-600">ספסל</span>
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {benchCount}
            </span>
          </div>
        </div>
      </div>

      {/* Flat player list */}
      <div className="space-y-2">
        {sortedPlayers.map((player) => {
          const currentTeamId = getEffectiveTeamId(player.id)
          const currentTeam = teams.find((t) => t.id === currentTeamId) ?? null
          const teamBtnClass = currentTeam
            ? (teamBtnColorClass[currentTeam.color] ?? 'bg-gray-100 border-gray-300 text-gray-600')
            : 'bg-gray-100 border-gray-200 text-gray-500'

          return (
            <div
              key={player.id}
              className="flex items-center gap-2 rounded-xl border bg-white p-2 text-sm shadow-sm"
              data-testid={`player-chip-${player.id}`}
            >
              {/* Delete button — only for bench players in admin mode */}
              {!currentTeamId && adminMode && onDeletePlayer ? (
                <button
                  type="button"
                  onClick={() => onDeletePlayer(player.id)}
                  disabled={disabled}
                  className="min-h-[32px] min-w-[32px] shrink-0 rounded-md bg-red-100 px-1.5 py-1 text-xs text-red-700"
                  data-testid={`player-delete-${player.id}`}
                >
                  ✕
                </button>
              ) : null}

              <span className="min-w-0 flex-1 truncate leading-tight">{player.name}</span>

              {/* Admin: rank dropdown + roles */}
              {adminMode ? (
                <div className="flex shrink-0 items-center gap-1">
                  <select
                    value={currentRankOf(player)}
                    onChange={(e) => onChangePlayerRank?.(player.id, e.target.value)}
                    disabled={disabled}
                    className={`min-h-[32px] rounded-md border px-1 py-0.5 text-xs font-bold ${rankClass[currentRankOf(player)] ?? 'bg-gray-100 text-gray-600'}`}
                    data-testid={`player-rank-${player.id}`}
                    title="דירוג שחקן"
                  >
                    {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onTogglePlayerRole?.(player.id, 'isOffense')}
                    className={`min-h-[32px] min-w-[32px] rounded-md px-1.5 py-1 text-xs ${player.isOffense ? 'bg-emerald-100' : 'bg-gray-100'}`}
                    data-testid={`player-offense-${player.id}`}
                  >
                    ⚔
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onTogglePlayerRole?.(player.id, 'isDefense')}
                    className={`min-h-[32px] min-w-[32px] rounded-md px-1.5 py-1 text-xs ${player.isDefense ? 'bg-sky-100' : 'bg-gray-100'}`}
                    data-testid={`player-defense-${player.id}`}
                  >
                    🛡
                  </button>
                </div>
              ) : null}

              {/* Team dropdown */}
              <select
                value={getEffectiveTeamId(player.id) ?? ''}
                onChange={(e) => setTeamForPlayer(player.id, e.target.value)}
                disabled={disabled}
                className={`min-h-[32px] shrink-0 rounded-md border px-1 py-0.5 text-xs font-bold transition-colors ${teamBtnClass}`}
                data-testid={`player-team-cycle-${player.id}`}
              >
                <option value="">–</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{getTeamDisplayName(t).slice(0, 6)}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>

      {/* Add player + utility buttons */}
      {adminMode ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoGenerate}
            disabled={disabled}
            data-testid="auto-generate-teams-button"
            className="min-h-[36px] rounded-lg border border-violet-300 bg-violet-50 px-3 py-1 text-xs text-violet-700 hover:bg-violet-100 disabled:opacity-40"
            title="חלק שחקנים אוטומטית לקבוצות מאוזנות"
          >
            ✨ אוטו
          </button>
          <button
            type="button"
            onClick={handleClean}
            disabled={disabled}
            data-testid="clean-teams-button"
            className="min-h-[36px] rounded-lg border border-orange-300 bg-orange-50 px-3 py-1 text-xs text-orange-700 hover:bg-orange-100 disabled:opacity-40"
            title="החזר את כל השחקנים לספסל"
          >
            נקה
          </button>
          <button
            type="button"
            onClick={cycleSortMode}
            className={`min-h-[36px] rounded-lg border px-3 py-1 text-xs transition-colors ${
              sortMode !== 'none'
                ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
            title="מיין שחקנים"
          >
            {sortModeLabel[sortMode]}
          </button>
        </div>
      ) : null}

      {adminMode ? <BenchAddRow onAddPlayer={onAddPlayer} /> : null}

      {/* Save button + unsaved-changes hint */}
      {adminMode ? (
        <div className="space-y-1">
          {hasChanges ? (
            <p className="text-center text-xs text-amber-600">יש שינויים שלא נשמרו — לחץ שמור</p>
          ) : (
            <p className="text-center text-xs text-gray-400">לחץ שמור לאחר ביצוע שינויים</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || !hasChanges}
            data-testid="selecting-mode-save"
            className={`min-h-[44px] w-full rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-40 ${
              hasChanges
                ? 'bg-green-500 shadow-md ring-2 ring-green-400 ring-offset-1 hover:bg-green-600'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            שמור
          </button>
        </div>
      ) : null}
    </div>
  )
}

const TeamBuilder = ({
  teams,
  players,
  maxPlayersPerTeam,
  disabled,
  adminMode,
  onMovePlayer,
  onBulkMoveAll,
  onChangeTeamColor,
  onChangeTeamName,
  onTogglePlayerRole,
  onChangePlayerRank,
  onDeletePlayer,
  onRenamePlayer,
  onAddPlayer,
  onCleanTeams,
  onAutoGenerate,
  onRemoveTeam,
  allowColorEdit = true,
  allowNameEdit = false,
  allowPlayerNameEdit = false,
}) => {
  const [mode, setMode] = useState('selecting')
  // Key incremented when switching to selecting to reset pending state
  const [selectingKey, setSelectingKey] = useState(0)
  const [collapsedTeams, setCollapsedTeams] = useState(new Set())
  const [benchCollapsed, setBenchCollapsed] = useState(false)

  const switchToSelecting = () => {
    setSelectingKey((k) => k + 1)
    setMode('selecting')
  }

  const toggleTeamCollapse = (teamId) => {
    setCollapsedTeams((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

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

  // Mode toggle — shown when there are teams
  const modeToggle = teams.length > 0 ? (
    <div className="mb-3 flex overflow-hidden rounded-xl border border-gray-200 text-sm" role="group" aria-label="מצב עריכה">
      <button
        type="button"
        onClick={switchToSelecting}
        data-testid="mode-toggle-selecting"
        className={`flex-1 px-3 py-2 transition-colors ${mode === 'selecting' ? 'bg-blue-600 font-semibold text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
      >
        בחירה
      </button>
      <button
        type="button"
        onClick={() => setMode('dragging')}
        data-testid="mode-toggle-dragging"
        className={`flex-1 px-3 py-2 transition-colors ${mode === 'dragging' ? 'bg-blue-600 font-semibold text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
      >
        גרירה
      </button>
    </div>
  ) : null

  if (mode === 'selecting') {
    return (
      <div>
        {modeToggle}
        <SelectingView
          key={selectingKey}
          teams={teams}
          players={players}
          maxPlayersPerTeam={maxPlayersPerTeam}
          disabled={disabled}
          adminMode={adminMode}
          onBulkMoveAll={onBulkMoveAll ?? (() => {})}
          onAddPlayer={onAddPlayer ?? (() => {})}
          onDeletePlayer={onDeletePlayer}
          onChangePlayerRank={onChangePlayerRank}
          onTogglePlayerRole={onTogglePlayerRole}
          onRemoveTeam={onRemoveTeam}
        />
      </div>
    )
  }

  // Dragging mode — original layout
  const benchColumn = (
    <TeamColumn
      title="שחקנים פנויים"
      players={benchPlayers}
      disabled={disabled}
      adminMode={adminMode}
      onDropPlayer={onMovePlayer}
      onTogglePlayerRole={onTogglePlayerRole}
      onChangePlayerRank={onChangePlayerRank}
      onDeletePlayer={onDeletePlayer}
      onRenamePlayer={onRenamePlayer}
      onAddPlayer={onAddPlayer ?? (() => {})}
      onCleanTeams={onCleanTeams}
      onAutoGenerate={onAutoGenerate}
      allowColorEdit={false}
      allowNameEdit={false}
      allowPlayerNameEdit={allowPlayerNameEdit}
      isCollapsed={benchCollapsed}
      onToggleCollapse={() => setBenchCollapsed((v) => !v)}
      isBench
    />
  )

  const teamCards = teams.map((team) => (
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
      onChangePlayerRank={onChangePlayerRank}
      onRenamePlayer={onRenamePlayer}
      onAddPlayer={onAddPlayer ?? (() => {})}
      onRemoveTeam={onRemoveTeam}
      allowColorEdit={allowColorEdit}
      allowNameEdit={allowNameEdit}
      allowPlayerNameEdit={allowPlayerNameEdit}
      isCollapsed={collapsedTeams.has(team.id)}
      onToggleCollapse={() => toggleTeamCollapse(team.id)}
    />
  ))

  if (benchCollapsed) {
    return (
      <div>
        {modeToggle}
        <div className="space-y-3">
          {benchColumn}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
            {teamCards}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {modeToggle}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-3">
          {teamCards}
        </div>
        {benchColumn}
      </div>
    </div>
  )
}

export default TeamBuilder
