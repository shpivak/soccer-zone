import { useMemo, useState } from 'react'
import { useAppContext } from './hooks/useAppContext'
import LiveTournament from './pages/LiveTournament'
import Stats from './pages/Stats'
import { getLeagueTypeLabel, LEAGUE_TYPES } from './utils/leagueUtils'

const ADMIN_PASSWORD = 'SoccerZone26'
const ADMIN_SESSION_KEY = 'soccer-zone-admin-auth'

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
    createLeague,
    setActiveLeagueId,
    setLeagues,
  } = useAppContext()
  const [page, setPage] = useState('live')
  const [adminMode, setAdminMode] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true')
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [adminPasswordError, setAdminPasswordError] = useState(false)
  const [newLeagueName, setNewLeagueName] = useState('')
  const [newLeagueType, setNewLeagueType] = useState(LEAGUE_TYPES.tournament)

  const activeLeague = useMemo(
    () => leagues.find((league) => league.id === activeLeagueId) ?? null,
    [activeLeagueId, leagues],
  )

  const handleAdminUnlock = () => {
    if (adminPasswordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true')
      setAdminMode(true)
      setAdminPasswordInput('')
      setAdminPasswordError(false)
    } else {
      setAdminPasswordError(true)
      setAdminPasswordInput('')
    }
  }

  const handleAdminLock = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY)
    setAdminMode(false)
    setAdminPasswordInput('')
    setAdminPasswordError(false)
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

  const handleSaveNewLeague = () => {
    if (!adminMode || !newLeagueName.trim()) return
    createLeague({ name: newLeagueName, type: newLeagueType })
    setNewLeagueName('')
    setNewLeagueType(LEAGUE_TYPES.tournament)
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
        <p className="mt-1 text-sm text-gray-600">פעולות הניהול למטה עובדות על הליגה הנבחרת בלבד.</p>

        {adminMode ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                <span>🔓 Admin mode</span>
                <button
                  onClick={handleAdminLock}
                  data-testid="admin-lock-button"
                  className="text-xs text-gray-500 underline hover:text-gray-800"
                >
                  נעל
                </button>
              </div>
              <button
                onClick={handleClearLeague}
                data-testid="clear-league-data"
                disabled={!isResetEnabled || isLoading}
                className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
              >
                נקה ליגה
              </button>
              <button
                onClick={handleResetLeagueToMockData}
                data-testid="reset-league-to-mock"
                disabled={activeDataset !== 'test' || !isResetEnabled || isLoading}
                className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
              >
                שחזר mock data
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-3">
              <h3 className="text-sm font-semibold text-gray-800">הוספת ליגה חדשה</h3>
              <p className="mt-1 text-xs text-gray-600">שם, סוג ליגה ושמירה. הליגה החדשה תיבחר אוטומטית.</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <input
                  value={newLeagueName}
                  onChange={(event) => setNewLeagueName(event.target.value)}
                  disabled={isLoading}
                  data-testid="add-league-name"
                  className="min-w-[10rem] flex-1 rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
                  placeholder="שם הליגה"
                />
                <select
                  value={newLeagueType}
                  onChange={(event) => setNewLeagueType(event.target.value)}
                  disabled={isLoading}
                  data-testid="add-league-type"
                  className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value={LEAGUE_TYPES.tournament}>{getLeagueTypeLabel(LEAGUE_TYPES.tournament)}</option>
                  <option value={LEAGUE_TYPES.regular}>{getLeagueTypeLabel(LEAGUE_TYPES.regular)}</option>
                  <option value={LEAGUE_TYPES.friendly}>{getLeagueTypeLabel(LEAGUE_TYPES.friendly)}</option>
                </select>
                <button
                  type="button"
                  onClick={handleSaveNewLeague}
                  disabled={isLoading || !newLeagueName.trim()}
                  data-testid="add-league-save"
                  className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
                >
                  שמור ליגה
                </button>
              </div>
            </div>

            {activeLeague ? (
              <div className="mt-4 grid gap-3 rounded-xl border p-3 md:grid-cols-3">
                <input
                  value={activeLeague.name}
                  onChange={(event) => handleLeagueMetaChange('name', event.target.value)}
                  data-testid="league-name-input"
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder="שם ליגה"
                />
                <input
                  value={activeLeague.seasonLabel ?? ''}
                  onChange={(event) => handleLeagueMetaChange('seasonLabel', event.target.value)}
                  data-testid="league-season-input"
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder="עונת ליגה"
                />
                <div className="rounded-xl border px-3 py-2 text-sm text-gray-600" data-testid="league-type-label">
                  {getLeagueTypeLabel(activeLeague.type)}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Admin mode</span>
            <input
              type="password"
              value={adminPasswordInput}
              onChange={(event) => {
                setAdminPasswordInput(event.target.value)
                setAdminPasswordError(false)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleAdminUnlock()
              }}
              data-testid="admin-password-input"
              placeholder="סיסמה"
              className={`w-28 rounded-xl border px-3 py-2 text-sm ${adminPasswordError ? 'border-red-400' : ''}`}
            />
            <button
              onClick={handleAdminUnlock}
              data-testid="admin-unlock-button"
              className="rounded-xl border px-3 py-2 text-sm"
            >
              🔓
            </button>
            {adminPasswordError ? (
              <span data-testid="admin-password-error" className="text-sm text-red-500">
                סיסמה שגויה
              </span>
            ) : null}
          </div>
        )}
      </section>
    </main>
  )
}

export default App
