const colorTitle = {
  black: 'שחור',
  yellow: 'צהוב',
  pink: 'ורוד',
  orange: 'כתום',
  blue: 'כחול',
  gray: 'אפור',
}

const ScoreBoard = ({ standings }) => {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">טבלת מצב חיה</h2>
      <div className="overflow-x-auto">
        <table data-testid="live-standings-table" className="min-w-full text-right text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">קבוצה</th>
              <th className="p-2">נק'</th>
              <th className="p-2">ניצחונות</th>
              <th className="p-2">תיקו</th>
              <th className="p-2">הפסדים</th>
              <th className="p-2">הפרש</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.teamId} className="border-b">
                <td className="p-2 font-semibold">{colorTitle[row.color] ?? row.teamId}</td>
                <td className="p-2">{row.points}</td>
                <td className="p-2">{row.wins}</td>
                <td className="p-2">{row.draws}</td>
                <td className="p-2">{row.losses}</td>
                <td className="p-2">{row.goalDiff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default ScoreBoard
