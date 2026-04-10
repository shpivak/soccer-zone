import { useEffect, useMemo, useRef, useState } from 'react'
import { getSessionDisplayName } from './utils/leagueUtils'
import soccerZoneLogo from './assets/soccer-zone-logo.jpeg'
import { useAppContext } from './hooks/useAppContext'
import LiveTournament from './pages/LiveTournament'
import Stats from './pages/Stats'
import WhatsNew from './components/WhatsNew'
import NotificationsPanel from './components/NotificationsPanel'
import { getLeagueTypeLabel, LEAGUE_TYPES } from './utils/leagueUtils'
import { generateTeamShareMessage } from './utils/shareUtils'

const ADMIN_PASSWORD = 'SoccerZone26'
const ADMIN_SESSION_KEY = 'soccer-zone-admin-auth'
const adminStorage = localStorage

const NavTab = ({ icon, label, active, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${active ? 'text-black' : 'text-gray-400'}`}
  >
    <span className="text-xl leading-none">{icon}</span>
    <span>{label}</span>
  </button>
)

const getLeagueIdFromUrl = () => {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('league') ?? ''
}

const syncLeagueIdToUrl = (leagueId) => {
  if (typeof window === 'undefined' || !leagueId) return
  const url = new URL(window.location.href)
  url.searchParams.set('league', leagueId)
  window.history.replaceState({}, '', url)
}

function App() {
  const {
    activeDataset,
    activeLeagueId,
    error,
    isLoading,
    isResetEnabled,
    clearActiveLeagueData,
    deleteActiveLeague,
    leagues,
    players,
    tournaments,
    resetActiveLeagueToMockData,
    createLeague,
    setActiveLeagueId,
    setLeagues,
  } = useAppContext()
  const [page, setPage] = useState('live')
  const [adminMode, setAdminMode] = useState(() => adminStorage.getItem(ADMIN_SESSION_KEY) === 'true')
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [adminPasswordError, setAdminPasswordError] = useState(false)
  const [newLeagueName, setNewLeagueName] = useState('')
  const [newLeagueType, setNewLeagueType] = useState(LEAGUE_TYPES.tournament)
  const didHydrateLeagueFromUrlRef = useRef(false)

  const activeLeague = useMemo(
    () => leagues.find((league) => league.id === activeLeagueId) ?? null,
    [activeLeagueId, leagues],
  )

  const leaguePlayers = useMemo(
    () => players.filter((p) => p.leagueId === activeLeagueId),
    [players, activeLeagueId],
  )

  const leagueTournamentsForNotif = useMemo(
    () => tournaments.filter((t) => t.leagueId === activeLeagueId),
    [tournaments, activeLeagueId],
  )

  const [notifTournamentId, setNotifTournamentId] = useState(null)

  const selectedTournamentForNotif = useMemo(() => {
    if (notifTournamentId) {
      const found = leagueTournamentsForNotif.find((t) => t.id === notifTournamentId)
      if (found) return found
    }
    return leagueTournamentsForNotif[leagueTournamentsForNotif.length - 1] ?? null
  }, [leagueTournamentsForNotif, notifTournamentId])

  const latestTeamsShareMsg = useMemo(() => {
    if (!selectedTournamentForNotif || !activeLeague) return ''
    return generateTeamShareMessage(selectedTournamentForNotif, leaguePlayers, activeLeague.name, activeLeague)
  }, [selectedTournamentForNotif, leaguePlayers, activeLeague])

  const latestTeamsForFixtures = useMemo(
    () => selectedTournamentForNotif?.teams ?? [],
    [selectedTournamentForNotif],
  )

  useEffect(() => {
    if (leagues.length === 0) return
    if (didHydrateLeagueFromUrlRef.current) return
    const leagueIdFromUrl = getLeagueIdFromUrl()
    if (leagueIdFromUrl && leagues.some((league) => league.id === leagueIdFromUrl) && leagueIdFromUrl !== activeLeagueId) {
      setActiveLeagueId(leagueIdFromUrl)
      return
    }
    didHydrateLeagueFromUrlRef.current = true
  }, [activeLeagueId, leagues, setActiveLeagueId])

  useEffect(() => {
    if (leagues.length === 0) return
    if (!didHydrateLeagueFromUrlRef.current) return
    syncLeagueIdToUrl(activeLeagueId)
  }, [activeLeagueId, leagues])

  const handleAdminUnlock = () => {
    if (adminPasswordInput === ADMIN_PASSWORD) {
      adminStorage.setItem(ADMIN_SESSION_KEY, 'true')
      setAdminMode(true)
      setAdminPasswordInput('')
      setAdminPasswordError(false)
    } else {
      setAdminPasswordError(true)
      setAdminPasswordInput('')
    }
  }

  const handleAdminLock = () => {
    adminStorage.removeItem(ADMIN_SESSION_KEY)
    setAdminMode(false)
    setAdminPasswordInput('')
    setAdminPasswordError(false)
  }

  const handleClearLeague = async () => {
    const approved = window.confirm(`למחוק את כל הנתונים של הליגה ${activeLeague?.name ?? activeLeagueId}?`)
    if (!approved) return
    await clearActiveLeagueData()
  }

  const handleDeleteLeague = async () => {
    const approved = window.confirm(
      `למחוק לצמיתות את הליגה "${activeLeague?.name ?? activeLeagueId}" כולל כל השחקנים, הטורנירים והתוצאות שלה?\n\nפעולה זו אינה הפיכה!`,
    )
    if (!approved) return
    await deleteActiveLeague()
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
        league.id === activeLeague.id ? { ...league, [field]: value } : league,
      ),
    )
  }

  return (
    <div className="min-h-screen bg-green-50">
      <WhatsNew adminMode={adminMode} />
      {/* Compact sticky header — league selector */}
      <header className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-3 py-2">
          <img src={soccerZoneLogo} alt="Soccer Zone FC" className="h-12 w-12 shrink-0 rounded-full object-cover" />
          <select
            value={activeLeagueId}
            onChange={(event) => setActiveLeagueId(event.target.value)}
            data-testid="league-select"
            className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-base font-semibold"
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name} ({getLeagueTypeLabel(league.type)})
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-2xl px-3 pb-24 pt-3">
        {error ? (
          <section
            className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
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
        ) : page === 'stats' ? (
          <Stats />
        ) : (
          /* Admin panel page */
          <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="management-panel">
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
                    className="min-h-[44px] rounded-xl bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    נקה ליגה
                  </button>
                  <button
                    onClick={handleDeleteLeague}
                    data-testid="delete-league"
                    disabled={isLoading}
                    className="min-h-[44px] rounded-xl bg-red-800 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    מחק ליגה
                  </button>
                  <button
                    onClick={handleResetLeagueToMockData}
                    data-testid="reset-league-to-mock"
                    disabled={activeDataset !== 'test' || !isResetEnabled || isLoading}
                    className="min-h-[44px] rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
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
                      className="min-w-[10rem] flex-1 rounded-xl border px-3 py-2.5 text-sm disabled:opacity-50"
                      placeholder="שם הליגה"
                    />
                    <select
                      value={newLeagueType}
                      onChange={(event) => setNewLeagueType(event.target.value)}
                      disabled={isLoading}
                      data-testid="add-league-type"
                      className="rounded-xl border px-3 py-2.5 text-sm disabled:opacity-50"
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
                      className="min-h-[44px] rounded-xl bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-40"
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

                {leagueTournamentsForNotif.length > 1 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-3">
                    <h3 className="text-sm font-semibold text-gray-800">📅 טורניר / סבב לשליחה</h3>
                    <select
                      value={notifTournamentId ?? selectedTournamentForNotif?.id ?? ''}
                      onChange={(e) => setNotifTournamentId(e.target.value || null)}
                      data-testid="notif-tournament-select"
                      className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                    >
                      {leagueTournamentsForNotif.map((t) => (
                        <option key={t.id} value={t.id}>
                          {getSessionDisplayName(t, activeLeague)} – {t.date ?? '-'}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <NotificationsPanel
                  leagueName={activeLeague?.name ?? ''}
                  teamsMsg={latestTeamsShareMsg}
                  teams={latestTeamsForFixtures}
                />
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
                  className="min-h-[44px] rounded-xl border px-3 py-2 text-sm"
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
        )}
      </main>

      {/* Fixed bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t bg-white">
        <NavTab
          icon="⚽"
          label="מצב משחק"
          active={page === 'live'}
          onClick={() => setPage('live')}
          testId="nav-live"
        />
        <NavTab
          icon="📊"
          label="סטטיסטיקות"
          active={page === 'stats'}
          onClick={() => setPage('stats')}
          testId="nav-stats"
        />
        <NavTab
          icon={adminMode ? '🔓' : '🔒'}
          label="ניהול"
          active={page === 'admin'}
          onClick={() => setPage('admin')}
          testId="nav-admin"
        />
      </nav>
    </div>
  )
}

export default App
