import { useEffect, useMemo, useState } from 'react'
import { getTeamDisplayName } from '../utils/leagueUtils'

const createGoalEvent = (teamId) => ({ type: 'goal', teamId, scorer: '', assister: '' })

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

const GameInput = ({ teams, players, disabled, onSave, editingGame, onCancelEdit, message }) => {
  const [teamA, setTeamA] = useState(editingGame?.teamA ?? teams[0]?.id ?? '')
  const [teamB, setTeamB] = useState(editingGame?.teamB ?? teams[1]?.id ?? '')
  const [scoreA, setScoreA] = useState(editingGame?.score.a ?? 0)
  const [scoreB, setScoreB] = useState(editingGame?.score.b ?? 0)
  const [events, setEvents] = useState(() => normalizeEditingEvents(editingGame, teams, players))
  const [clockSeconds, setClockSeconds] = useState(editingGame?.clockSeconds ?? 0)
  const [isClockRunning, setIsClockRunning] = useState(false)

  useEffect(() => {
    if (!isClockRunning) return undefined
    const intervalId = window.setInterval(() => {
      setClockSeconds((current) => current + 1)
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [isClockRunning])

  const teamAPlayers = useMemo(
    () => players.filter((player) => teams.find((team) => team.id === teamA)?.players.includes(player.id)),
    [players, teamA, teams],
  )
  const teamBPlayers = useMemo(
    () => players.filter((player) => teams.find((team) => team.id === teamB)?.players.includes(player.id)),
    [players, teamB, teams],
  )

  const resetForm = () => {
    setScoreA(0)
    setScoreB(0)
    setEvents([])
    setClockSeconds(0)
    setIsClockRunning(false)
    setTeamA(teams[0]?.id ?? '')
    setTeamB(teams[1]?.id ?? '')
  }

  const updateScore = (targetTeamId, delta) => {
    if (!targetTeamId) return
    if (targetTeamId === teamA) {
      if (delta > 0) {
        setScoreA((current) => current + 1)
        setEvents((current) => [...current, createGoalEvent(teamA)])
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
        setEvents((current) => [...current, createGoalEvent(teamB)])
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
      events: events.map((event) => ({
        type: 'goal',
        teamId: event.teamId,
        scorer: event.scorer,
        ...(event.assister ? { assister: event.assister } : {}),
      })),
    })
    resetForm()
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">{editingGame ? 'עריכת משחק' : 'הזנת משחק חדש'}</h2>

      <div className="rounded-2xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="space-y-3 text-center">
            <select
              value={teamA}
              disabled={disabled}
              onChange={(event) => setTeamA(event.target.value)}
              data-testid="game-team-a-select"
              className="w-full rounded-xl border border-gray-300 bg-white p-2 text-center"
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

          <div className="space-y-3 text-center">
            <div className="text-sm uppercase tracking-[0.3em] text-gray-400">Live</div>
            <div data-testid="game-timer-display" className="text-4xl font-black">
              {formatClock(clockSeconds)}
            </div>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setIsClockRunning(true)}
                data-testid="game-timer-start"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-emerald-500 px-3 py-2 text-lg font-semibold text-black"
              >
                ▶
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setIsClockRunning(false)}
                data-testid="game-timer-pause"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-amber-400 px-3 py-2 text-lg font-semibold text-black"
              >
                ⏸
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setIsClockRunning(false)
                  setClockSeconds(0)
                }}
                data-testid="game-timer-reset"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-gray-100 px-3 py-2 text-lg"
              >
                🔄
              </button>
            </div>
          </div>

          <div className="space-y-3 text-center">
            <select
              value={teamB}
              disabled={disabled}
              onChange={(event) => setTeamB(event.target.value)}
              data-testid="game-team-b-select"
              className="w-full rounded-xl border border-gray-300 bg-white p-2 text-center"
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
      </div>

      {events.length > 0 ? (
        <div className="mt-4 space-y-2">
          <h3 className="font-semibold">אירועי שערים</h3>
          {events.map((event, index) => {
            const eventPlayers = event.teamId === teamA ? teamAPlayers : teamBPlayers
            return (
              <div key={`event-${index}`} className="grid gap-2 rounded-xl border p-2 md:grid-cols-[180px_1fr_1fr]">
                <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold">
                  {getTeamDisplayName(teams.find((team) => team.id === event.teamId))}
                </div>
                <select
                  value={event.scorer}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...events]
                    next[index] = { ...next[index], scorer: e.target.value }
                    setEvents(next)
                  }}
                  data-testid={`event-scorer-${index}`}
                  className="rounded-lg border p-2"
                >
                  <option value="">כובש</option>
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
                    next[index] = { ...next[index], assister: e.target.value }
                    setEvents(next)
                  }}
                  data-testid={`event-assister-${index}`}
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
