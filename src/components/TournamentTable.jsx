const colorTitle = {
  black: 'שחור',
  yellow: 'צהוב',
  pink: 'ורוד',
  orange: 'כתום',
  blue: 'כחול',
  gray: 'אפור',
}

const TournamentTable = ({ games, teams, onEdit, onDelete, readOnly }) => {
  const teamMap = new Map(teams.map((team) => [team.id, colorTitle[team.color] ?? team.color]))
  const teamSlugMap = new Map(teams.map((team) => [team.id, team.color]))

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">משחקים בטורניר</h2>
      <div className="space-y-3">
        {games.map((game) => (
          <article key={game.id} data-testid={`game-row-${game.id}`} className="rounded-xl border p-3">
            <p className="text-sm text-gray-500">
              סבב {game.round ?? 1} - {teamSlugMap.get(game.teamA)}-{teamSlugMap.get(game.teamB)}
            </p>
            <p className="text-lg font-semibold">
              {teamMap.get(game.teamA)} {game.score.a} - {game.score.b} {teamMap.get(game.teamB)}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => onEdit(game)}
                disabled={readOnly}
                data-testid={`edit-game-${game.id}`}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
              >
                עריכה
              </button>
              <button
                onClick={() => onDelete(game.id)}
                disabled={readOnly}
                data-testid={`delete-game-${game.id}`}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                מחיקה
              </button>
            </div>
          </article>
        ))}
        {games.length === 0 && <p className="text-sm text-gray-500">עדיין לא הוזנו משחקים.</p>}
      </div>
    </section>
  )
}

export default TournamentTable
