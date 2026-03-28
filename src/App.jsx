import { useMemo, useState } from 'react'
import { useAppContext } from './hooks/useAppContext'
import LiveTournament from './pages/LiveTournament'
import Stats from './pages/Stats'
import { getLeagueTypeLabel } from './utils/leagueUtils'
import { AVAILABLE_DATASETS } from './utils/storageConfig'

function App() {
  const {
    activeDataset,
    activeLeagueId,
    error,
    isLoading,
    isResetEnabled,
    clearActiveLeagueData,
    leagues,
    resetActiveLeagueToMockData,
    setActiveDataset,
    setActiveLeagueId,
    setLeagues,
  } = useAppContext()
  const [page, setPage] = useState('live')
  const [adminMode, setAdminMode] = useState(true)

  const activeLeague = useMemo(
    () => leagues.find((league) => league.id === activeLeagueId) ?? null,
    [activeLeagueId, leagues],
  )

  const handleDatasetChange = (event) => {
    const next = event.target.value
    if (next === 'prod') {
      const approved = window.confirm('מעבר ל-PROD הוא מצב ייצור. האם להמשיך?')
      if (!approved) return
    }
    setActiveDataset(next)
  }

  const handleClearLeague = async () => {
    const approved = window.confirm(`למחוק את כל הנתונים של הליגה ${activeLeague?.name ?? activeLeagueId}?`)
    if (!approved) return
    await clearActiveLeagueData()
  }

  const handleResetLeagueToMockData = async () => {
    const approved = window.confirm(`לאפס את הליגה ${activeLeague?.name ?? activeLeagueId} לדאטת ה-mock המקורית?`)
    if (!approved) return
    await resetActiveLeagueToMockData()
  }

  const handleLeagueMetaChange = (field, value) => {
    if (!activeLeague) return
    setLeagues((current) =>
      current.map((league) =>
        league.id === activeLeague.id
          ? {
              ...league,
              [field]: value,
            }
          : league,
      ),
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-3 pb-10 md:p-6">
      <header className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">מעקב ליגת כדורגל חובבנית</h1>
        <p className="mt-1 text-sm text-gray-600">ניהול ליגות טורנירים, ליגה סדירה ומשחקי ידידות</p>
        <p className="mt-1 text-sm text-gray-600">כל ליגה מוגדרת לפי סוג הליגה שלה ונטענת עם סטטיסטיקות מתאימות.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setPage('live')}
            data-testid="nav-live"
            className={`rounded-xl px-4 py-3 text-sm ${page === 'live' ? 'bg-black text-white' : 'border'}`}
          >
            מצב חי
          </button>
          <button
            onClick={() => setPage('stats')}
            data-testid="nav-stats"
            className={`rounded-xl px-4 py-3 text-sm ${page === 'stats' ? 'bg-black text-white' : 'border'}`}
          >
            סטטיסטיקות
          </button>

          <select
            value={activeLeagueId}
            onChange={(event) => setActiveLeagueId(event.target.value)}
            data-testid="league-select"
            className="rounded-xl border px-3 py-2 text-sm"
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name} ({getLeagueTypeLabel(league.type)})
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? (
        <section
          className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          data-testid="storage-error"
        >
          {error}
        </section>
      ) : null}

      {isLoading ? (
        <section className="rounded-2xl bg-white p-4 text-sm shadow-sm" data-testid="loading-state">
          טוען נתונים...
        </section>
      ) : page === 'live' ? (
        <LiveTournament adminMode={adminMode} />
      ) : (
        <Stats />
      )}

      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm" data-testid="management-panel">
        <h2 className="text-base font-bold">אזור ניהול וכלי מערכת</h2>
        <p className="mt-1 text-sm text-gray-600">מצב ניהול פעיל כאן כברירת מחדל. פעולות הניהול למטה עובדות על הליגה הנבחרת בלבד.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
            <span>Admin mode</span>
            <input
              type="checkbox"
              checked={adminMode}
              onChange={(event) => setAdminMode(event.target.checked)}
              data-testid="admin-toggle"
              className="h-5 w-5"
            />
          </label>
          <select
            value={activeDataset}
            onChange={handleDatasetChange}
            data-testid="dataset-select"
            disabled={!adminMode}
            className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
          >
            {AVAILABLE_DATASETS.map((dataset) => (
              <option key={dataset} value={dataset}>
                {dataset}
              </option>
            ))}
          </select>
          <button
            onClick={handleClearLeague}
            data-testid="clear-league-data"
            disabled={!adminMode || !isResetEnabled || isLoading}
            className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
          >
            נקה ליגה
          </button>
          <button
            onClick={handleResetLeagueToMockData}
            data-testid="reset-league-to-mock"
            disabled={!adminMode || !isResetEnabled || isLoading}
            className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
          >
            שחזר mock data
          </button>
        </div>

        {activeLeague ? (
          <div className="mt-4 grid gap-3 rounded-xl border p-3 md:grid-cols-3">
            <input
              value={activeLeague.name}
              onChange={(event) => handleLeagueMetaChange('name', event.target.value)}
              disabled={!adminMode}
              data-testid="league-name-input"
              className="rounded-xl border px-3 py-2 text-sm"
              placeholder="שם ליגה"
            />
            <input
              value={activeLeague.seasonLabel ?? ''}
              onChange={(event) => handleLeagueMetaChange('seasonLabel', event.target.value)}
              disabled={!adminMode}
              data-testid="league-season-input"
              className="rounded-xl border px-3 py-2 text-sm"
              placeholder="עונת ליגה"
            />
            <div className="rounded-xl border px-3 py-2 text-sm text-gray-600" data-testid="league-type-label">
              {getLeagueTypeLabel(activeLeague.type)}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default App
