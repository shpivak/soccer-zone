import { useMemo, useState } from 'react'
import { getTeamDisplayName } from '../utils/leagueUtils'

const createEmptyEvent = () => ({ type: 'goal', scorer: '', assister: '' })

const GameInput = ({ teams, players, disabled, onSave, editingGame, onCancelEdit, message }) => {
  const [teamA, setTeamA] = useState(editingGame?.teamA ?? teams[0]?.id ?? '')
  const [teamB, setTeamB] = useState(editingGame?.teamB ?? teams[1]?.id ?? '')
  const [scoreA, setScoreA] = useState(editingGame?.score.a ?? 0)
  const [scoreB, setScoreB] = useState(editingGame?.score.b ?? 0)
  const [events, setEvents] = useState(editingGame?.events ?? [])

  const availablePlayers = useMemo(() => {
    const selectedTeams = teams.filter((team) => team.id === teamA || team.id === teamB)
    const ids = selectedTeams.flatMap((team) => team.players)
    return players.filter((player) => ids.includes(player.id))
  }, [teamA, teamB, teams, players])

  const syncEventsCount = (a, b) => {
    const nextCount = Number(a) + Number(b)
    setEvents((current) => {
      if (current.length === nextCount) return current
      if (current.length > nextCount) return current.slice(0, nextCount)
      return [...current, ...Array.from({ length: nextCount - current.length }, createEmptyEvent)]
    })
  }

  const resetForm = () => {
    setScoreA(0)
    setScoreB(0)
    setEvents([])
    setTeamA(teams[0]?.id ?? '')
    setTeamB(teams[1]?.id ?? '')
  }

  const handleSave = () => {
    if (!teamA || !teamB || teamA === teamB) return
    onSave({
      id: editingGame?.id ?? `g${Date.now()}`,
      teamA,
      teamB,
      score: { a: Number(scoreA), b: Number(scoreB) },
      events: events.map((event) => ({
        type: 'goal',
        scorer: event.scorer,
        ...(event.assister ? { assister: event.assister } : {}),
      })),
    })
    resetForm()
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">{editingGame ? 'עריכת משחק' : 'הזנת משחק חדש'}</h2>
      <div className="grid gap-2 md:grid-cols-2">
        <select
          value={teamA}
          disabled={disabled}
          onChange={(event) => setTeamA(event.target.value)}
          data-testid="game-team-a-select"
          className="rounded-xl border p-3"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {getTeamDisplayName(team)}
            </option>
          ))}
        </select>
        <select
          value={teamB}
          disabled={disabled}
          onChange={(event) => setTeamB(event.target.value)}
          data-testid="game-team-b-select"
          className="rounded-xl border p-3"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {getTeamDisplayName(team)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          type="number"
          min="0"
          value={scoreA}
          disabled={disabled}
          onChange={(event) => {
            setScoreA(event.target.value)
            syncEventsCount(event.target.value, scoreB)
          }}
          data-testid="score-a-input"
          className="rounded-xl border p-3 text-center text-xl font-bold"
        />
        <input
          type="number"
          min="0"
          value={scoreB}
          disabled={disabled}
          onChange={(event) => {
            setScoreB(event.target.value)
            syncEventsCount(scoreA, event.target.value)
          }}
          data-testid="score-b-input"
          className="rounded-xl border p-3 text-center text-xl font-bold"
        />
      </div>

      {events.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="font-semibold">אירועי שערים (אופציונלי)</h3>
          {events.map((event, index) => (
            <div key={`event-${index}`} className="grid gap-2 rounded-xl border p-2 md:grid-cols-2">
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
                {availablePlayers.map((player) => (
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
                {availablePlayers.map((player) => (
                  <option key={`assist-${player.id}`} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

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
          className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-white disabled:opacity-40"
        >
          {editingGame ? 'שמירת עדכון' : 'שמירת משחק'}
        </button>
        {editingGame && (
          <button
            disabled={disabled}
            onClick={() => {
              onCancelEdit()
              resetForm()
            }}
            data-testid="cancel-edit-game"
            className="rounded-xl border px-4 py-3"
          >
            ביטול
          </button>
        )}
      </div>
    </section>
  )
}

export default GameInput
