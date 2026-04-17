import { useEffect, useMemo, useState } from 'react'
import { getTeamDisplayName } from '../utils/leagueUtils'

const createGoalEvent = (teamId, minute) => ({
  type: 'goal', teamId, scorer: '', assister: '',
  ...(minute !== undefined ? { minute } : {}),
})

const inferEventTeamId = (event, teams, players, fallbackTeamId) => {
  if (event.teamId) return event.teamId
  const scorerTeam = teams.find((team) => team.players.includes(event.scorer))
  if (scorerTeam) return scorerTeam.id
  return fallbackTeamId
}

const formatClock = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

const teamColorClass = {
  black: 'bg-gray-200 border-gray-500',
  yellow: 'bg-yellow-50 border-yellow-300',
  pink: 'bg-pink-50 border-pink-300',
  orange: 'bg-orange-50 border-orange-300',
  blue: 'bg-blue-50 border-blue-300',
  gray: 'bg-gray-50 border-gray-300',
  white: 'bg-white border-gray-300',
}

const normalizeEditingEvents = (editingGame, teams, players) => {
  if (!editingGame) return []

  const normalized = []
  let fallbackForA = 0
  ;(editingGame.events ?? []).forEach((event) => {
    const fallbackTeamId = fallbackForA < editingGame.score.a ? editingGame.teamA : editingGame.teamB
    normalized.push({ ...event, teamId: inferEventTeamId(event, teams, players, fallbackTeamId) })
    if (fallbackTeamId === editingGame.teamA) fallbackForA += 1
  })
  return normalized
}

const GameInput = ({ teams, players, disabled, onSave, editingGame, onCancelEdit, message, persistKey }) => {
  const storageKey = persistKey && !editingGame ? `live-score-${persistKey}` : null

  const [storedState] = useState(() => {
    if (!storageKey) return null
    try { return JSON.parse(sessionStorage.getItem(storageKey) || 'null') } catch { return null }
  })

  const teamIds = teams.map((t) => t.id)
  const [teamA, setTeamA] = useState(() => {
    if (storedState?.teamA && teamIds.includes(storedState.teamA)) return storedState.teamA
    return editingGame?.teamA ?? teams[0]?.id ?? ''
  })
  const [teamB, setTeamB] = useState(() => {
    if (storedState?.teamB && teamIds.includes(storedState.teamB)) return storedState.teamB
    return editingGame?.teamB ?? teams[1]?.id ?? ''
  })
  const [scoreA, setScoreA] = useState(() => storedState?.scoreA ?? editingGame?.score.a ?? 0)
  const [scoreB, setScoreB] = useState(() => storedState?.scoreB ?? editingGame?.score.b ?? 0)
  const [events, setEvents] = useState(() => storedState?.events ?? normalizeEditingEvents(editingGame, teams, players))
  const [clockSeconds, setClockSeconds] = useState(() => storedState?.clockSeconds ?? editingGame?.clockSeconds ?? 0)
  const [isClockRunning, setIsClockRunning] = useState(false)
  const [clockMs, setClockMs] = useState(0)
  const [showTimer, setShowTimer] = useState(false)
  const [matchDescription, setMatchDescription] = useState(() => storedState?.matchDescription ?? editingGame?.description ?? '')

  useEffect(() => {
    if (!storageKey) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ teamA, teamB, scoreA, scoreB, events, clockSeconds, matchDescription }))
    } catch { /* ignore */ }
  }, [storageKey, teamA, teamB, scoreA, scoreB, events, clockSeconds, matchDescription])

  useEffect(() => {
    if (!isClockRunning) return undefined
    const intervalId = window.setInterval(() => {
      setClockSeconds((current) => current + 1)
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [isClockRunning])

  useEffect(() => {
    if (!isClockRunning) return undefined
    const msId = window.setInterval(() => {
      setClockMs((prev) => (prev + Math.floor(Math.random() * 13) + 5) % 100)
    }, 80)
    return () => window.clearInterval(msId)
  }, [isClockRunning])

  const teamAColor = teams.find((t) => t.id === teamA)?.color ?? 'gray'
  const teamBColor = teams.find((t) => t.id === teamB)?.color ?? 'gray'

  const teamAPlayers = useMemo(
    () => players.filter((player) => teams.find((team) => team.id === teamA)?.players.includes(player.id)),
    [players, teamA, teams],
  )
  const teamBPlayers = useMemo(
    () => players.filter((player) => teams.find((team) => team.id === teamB)?.players.includes(player.id)),
    [players, teamB, teams],
  )

  const resetForm = () => {
    if (storageKey) try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
    setScoreA(0)
    setScoreB(0)
    setEvents([])
    setClockSeconds(0)
    setIsClockRunning(false)
    setClockMs(0)
    setMatchDescription('')
    setTeamA(teams[0]?.id ?? '')
    setTeamB(teams[1]?.id ?? '')
  }

  const updateScore = (targetTeamId, delta) => {
    if (!targetTeamId) return
    if (targetTeamId === teamA) {
      if (delta > 0) {
        setScoreA((current) => current + 1)
        setEvents((current) => [...current, createGoalEvent(teamA, isClockRunning ? Math.floor(clockSeconds / 60) + 1 : undefined)])
      } else if (scoreA > 0) {
        setScoreA((current) => current - 1)
        setEvents((current) => {
          const next = [...current]
          const index = next.map((event) => event.teamId).lastIndexOf(teamA)
          if (index >= 0) next.splice(index, 1)
          return next
        })
      }
      return
    }

    if (targetTeamId === teamB) {
      if (delta > 0) {
        setScoreB((current) => current + 1)
        setEvents((current) => [...current, createGoalEvent(teamB, isClockRunning ? Math.floor(clockSeconds / 60) + 1 : undefined)])
      } else if (scoreB > 0) {
        setScoreB((current) => current - 1)
        setEvents((current) => {
          const next = [...current]
          const index = next.map((event) => event.teamId).lastIndexOf(teamB)
          if (index >= 0) next.splice(index, 1)
          return next
        })
      }
    }
  }

  const handleSave = () => {
    if (!teamA || !teamB || teamA === teamB) return
    onSave({
      id: editingGame?.id ?? `g${Date.now()}`,
      teamA,
      teamB,
      score: { a: Number(scoreA), b: Number(scoreB) },
      clockSeconds,
      ...(matchDescription.trim() ? { description: matchDescription.trim() } : {}),
      events: events.map((event) => ({
        type: 'goal',
        teamId: event.teamId,
        scorer: event.scorer,
        ...(event.assister ? { assister: event.assister } : {}),
        ...(event.minute !== undefined ? { minute: event.minute } : {}),
      })),
    })
    resetForm()
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">{editingGame ? 'עריכת משחק' : 'הזנת משחק חדש'}</h2>

      <div className="rounded-2xl border bg-white p-4">
        {/* Teams and scores – always side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Team A */}
          <div className={`space-y-2 rounded-xl border p-3 text-center ${teamColorClass[teamAColor] ?? 'bg-gray-50 border-gray-300'}`}>
            <select
              value={teamA}
              disabled={disabled}
              onChange={(event) => setTeamA(event.target.value)}
              data-testid="game-team-a-select"
              className="w-full rounded-xl border border-gray-300 bg-white p-2 text-center text-sm"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id} className="text-black">
                  {getTeamDisplayName(team)}
                </option>
              ))}
            </select>
            <div className="text-5xl font-black" data-testid="score-a-input">
              {scoreA}
            </div>
            {!disabled && (
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => updateScore(teamA, 1)}
                  data-testid="score-a-plus"
                  className="min-h-[48px] min-w-[48px] rounded-xl bg-green-600 px-4 py-3 text-lg font-bold text-white"
                >
                  +
                </button>
                <button
                  type="button"
                  disabled={scoreA === 0}
                  onClick={() => updateScore(teamA, -1)}
                  data-testid="score-a-minus"
                  className="min-h-[48px] min-w-[48px] rounded-xl bg-red-600 px-4 py-3 text-lg font-bold text-white disabled:opacity-40"
                >
                  -
                </button>
              </div>
            )}
          </div>

          {/* Team B */}
          <div className={`space-y-2 rounded-xl border p-3 text-center ${teamColorClass[teamBColor] ?? 'bg-gray-50 border-gray-300'}`}>
            <select
              value={teamB}
              disabled={disabled}
              onChange={(event) => setTeamB(event.target.value)}
              data-testid="game-team-b-select"
              className="w-full rounded-xl border border-gray-300 bg-white p-2 text-center text-sm"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id} className="text-black">
                  {getTeamDisplayName(team)}
                </option>
              ))}
            </select>
            <div className="text-5xl font-black" data-testid="score-b-input">
              {scoreB}
            </div>
            {!disabled && (
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => updateScore(teamB, 1)}
                  data-testid="score-b-plus"
                  className="min-h-[48px] min-w-[48px] rounded-xl bg-green-600 px-4 py-3 text-lg font-bold text-white"
                >
                  +
                </button>
                <button
                  type="button"
                  disabled={scoreB === 0}
                  onClick={() => updateScore(teamB, -1)}
                  data-testid="score-b-minus"
                  className="min-h-[48px] min-w-[48px] rounded-xl bg-red-600 px-4 py-3 text-lg font-bold text-white disabled:opacity-40"
                >
                  -
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Timer – optional, smaller, below scores */}
        <div className="mt-3 border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">⏱ שעון משחק</span>
            <button
              type="button"
              onClick={() => setShowTimer((v) => !v)}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              {showTimer ? 'הסתר' : 'הצג'}
            </button>
          </div>
          {showTimer && (
            <div className="mt-2 text-center">
              <div data-testid="game-timer-display" className="text-2xl font-black tabular-nums">
                {formatClock(clockSeconds)}
                <span className="text-sm font-medium text-gray-400">
                  .{String(clockMs).padStart(2, '0')}
                </span>
              </div>
              <div className="mt-2 flex justify-center gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setIsClockRunning(true)}
                  data-testid="game-timer-start"
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-emerald-500 px-3 py-2 text-base font-semibold text-black"
                >
                  ▶
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setIsClockRunning(false)}
                  data-testid="game-timer-pause"
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-amber-400 px-3 py-2 text-base font-semibold text-black"
                >
                  ⏸
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setIsClockRunning(false)
                    setClockSeconds(0)
                    setClockMs(0)
                  }}
                  data-testid="game-timer-reset"
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-gray-100 px-3 py-2 text-base"
                >
                  🔄
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Optional match description */}
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-gray-500">📝 תיאור המשחק (אופציונלי)</label>
        <textarea
          value={matchDescription}
          disabled={disabled}
          onChange={(e) => setMatchDescription(e.target.value)}
          placeholder="לדוגמה: משחק סוער עם הפיכות רבות..."
          rows={2}
          data-testid="game-description-input"
          className="w-full resize-none rounded-xl border border-gray-300 p-3 text-sm disabled:opacity-50"
        />
      </div>

      {events.length > 0 ? (
        <div className="mt-4 space-y-2">
          <h3 className="font-semibold">אירועי שערים</h3>
          {[...events].map((event, originalIndex) => ({ event, originalIndex })).reverse().map(({ event, originalIndex }) => {
            const eventPlayers = event.teamId === teamA ? teamAPlayers : teamBPlayers
            return (
              <div key={`event-${originalIndex}`} className="grid gap-2 rounded-xl border p-2 md:grid-cols-[180px_1fr_1fr]">
                <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold">
                  <span>{getTeamDisplayName(teams.find((team) => team.id === event.teamId))}</span>
                  {event.minute !== undefined ? (
                    <span className="text-xs font-normal text-gray-500">{event.minute}'</span>
                  ) : null}
                </div>
                <select
                  value={event.scorer}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...events]
                    next[originalIndex] = { ...next[originalIndex], scorer: e.target.value }
                    setEvents(next)
                  }}
                  data-testid={`event-scorer-${originalIndex}`}
                  className="rounded-lg border p-2"
                >
                  <option value="">כובש (אופציונלי)</option>
                  {eventPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
                <select
                  value={event.assister}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...events]
                    next[originalIndex] = { ...next[originalIndex], assister: e.target.value }
                    setEvents(next)
                  }}
                  data-testid={`event-assister-${originalIndex}`}
                  className="rounded-lg border p-2"
                >
                  <option value="">מבשל (אופציונלי)</option>
                  {eventPlayers.map((player) => (
                    <option key={`assist-${player.id}`} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      ) : null}

      {message ? (
        <p data-testid="game-input-message" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {message}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          disabled={disabled}
          onClick={handleSave}
          data-testid="save-game-button"
          className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-white disabled:opacity-40"
        >
          {editingGame ? 'שמירת עדכון' : 'שמירת משחק'}
        </button>
        {editingGame ? (
          <button
            disabled={disabled}
            onClick={() => {
              onCancelEdit()
              resetForm()
            }}
            data-testid="cancel-edit-game"
            className="rounded-xl bg-red-600 px-4 py-3 text-white disabled:opacity-40"
          >
            ביטול
          </button>
        ) : null}
      </div>
    </section>
  )
}

export default GameInput
