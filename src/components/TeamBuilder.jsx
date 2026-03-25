import { APP_CONFIG } from '../config'

const colorLabel = {
  black: 'שחור',
  yellow: 'צהוב',
  pink: 'ורוד',
  orange: 'כתום',
  blue: 'כחול',
  gray: 'אפור',
}

const colorClass = {
  black: 'bg-gray-200 border-gray-500',
  yellow: 'bg-yellow-50 border-yellow-300',
  pink: 'bg-pink-50 border-pink-300',
  orange: 'bg-orange-50 border-orange-300',
  blue: 'bg-blue-50 border-blue-300',
  gray: 'bg-gray-50 border-gray-300',
}

const TeamBuilder = ({ teams, players, disabled, onAssignPlayer, onChangeTeamColor, message }) => {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">בניית קבוצות</h2>
      {message && (
        <p data-testid="team-builder-message" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {teams.map((team) => (
          <div
            key={team.id}
            data-testid={`team-card-${team.id}`}
            className={`rounded-xl border p-3 ${colorClass[team.color] ?? 'bg-gray-50 border-gray-300'}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold">קבוצת {colorLabel[team.color] ?? team.color}</h3>
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
            </div>
            <div className="space-y-2">
              {players.map((player) => {
                const isSelected = team.players.includes(player.id)
                return (
                  <label key={player.id} className="flex items-center justify-between text-sm">
                    <span>{player.name}</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disabled}
                      onChange={(event) => onAssignPlayer(team.id, player.id, event.target.checked)}
                      data-testid={`team-player-${team.id}-${player.id}`}
                      className="h-5 w-5"
                    />
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default TeamBuilder
