import { useState } from 'react'
import { APP_CONFIG } from './config'
import { useAppContext } from './hooks/useAppContext'
import LiveTournament from './pages/LiveTournament'
import Stats from './pages/Stats'
import { AVAILABLE_DATASETS } from './utils/storageConfig'

function App() {
  const {
    activeDataset,
    activeLeagueId,
    error,
    isLoading,
    isResetEnabled,
    clearActiveLeagueData,
    resetActiveLeagueToMockData,
    setActiveDataset,
    setActiveLeagueId,
  } = useAppContext()
  const [page, setPage] = useState('live')
  const [adminMode, setAdminMode] = useState(true)

  const handleDatasetChange = (event) => {
    const next = event.target.value
    if (next === 'prod') {
      const approved = window.confirm('מעבר ל-PROD הוא מצב ייצור. האם להמשיך?')
      if (!approved) return
    }
    setActiveDataset(next)
  }

  const handleClearLeague = async () => {
    const league = APP_CONFIG.leagues.find((item) => item.id === activeLeagueId)
    const approved = window.confirm(`למחוק את כל השחקנים והטורנירים של הליגה ${league?.name ?? activeLeagueId}?`)
    if (!approved) return
    await clearActiveLeagueData()
  }

  const handleResetLeagueToMockData = async () => {
    const league = APP_CONFIG.leagues.find((item) => item.id === activeLeagueId)
    const approved = window.confirm(`לאפס את הליגה ${league?.name ?? activeLeagueId} לדאטת ה-mock המקורית?`)
    if (!approved) return
    await resetActiveLeagueToMockData()
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl p-3 pb-10 md:p-6">
      <header className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">מעקב ליגת כדורגל חובבנית</h1>
        <p className="mt-1 text-sm text-gray-600">ניהול טורניר חי + סטטיסטיקות מצטברות</p>
        <p className="mt-1 text-sm text-gray-600">
          בחירת ליגה מסננת את רשימת הטורנירים במצב החי ואת דף הסטטיסטיקות.
        </p>
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
            {APP_CONFIG.leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? (
        <section className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="storage-error">
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
        <p className="mt-1 text-sm text-gray-600">
          מצב ניהול פעיל כאן כברירת מחדל. פעולות הניהול למטה עובדות על הליגה הנבחרת בלבד.
        </p>
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
      </section>
    </main>
  )
}

export default App
