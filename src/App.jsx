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
import { IS_LITE_MODE, LITE_SUPER_PASSWORD } from './utils/storageConfig'
import { hashPassword } from './utils/passwordHash'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? ''
const COACH_SESSION_KEY = 'soccer-zone-coach-id'

// ─── Coach definitions (parsed from VITE_COACHES env var) ────────────────────
// Format: "EnglishId:שםבעברית:password;..." — stored as a GH secret
const parseCoachesFromEnv = () => {
  const raw = import.meta.env.VITE_COACHES ?? ''
  return raw.split(';').filter(Boolean).map((part) => {
    const [id, name, password] = part.trim().split(':')
    return { id: id.toLowerCase().trim(), name: name.trim(), password: password.trim() }
  })
}
const COACHES = parseCoachesFromEnv()
const COACH_ALL = '__admin__'

// ─── LITE: read path captured by 404.html (GitHub Pages SPA routing) ─────────
// sessionStorage is read once at module load — before React mounts — so the
// value is available synchronously in useState initialisers.
const _liteRedirectPath = (() => {
  if (typeof sessionStorage === 'undefined') return ''
  const p = sessionStorage.getItem('__lite_redirect_path')
  if (p) sessionStorage.removeItem('__lite_redirect_path')
  return p ?? ''
})()

/**
 * Extracts the league slug from the URL path.
 * Prefers the path stored by 404.html (GitHub Pages); falls back to
 * window.location.pathname for local dev where the dev server handles SPAs.
 *
 * BASE_URL is '/soccer-lite/' in a lite Pages deploy and '/' locally.
 * Example: pathname '/soccer-lite/friday-hodash' → 'friday-hodash'
 */
const getLeagueSlugFromPath = () => {
  const rawPath = _liteRedirectPath || window.location.pathname
  const base = import.meta.env.BASE_URL // '/soccer-lite/' or '/'
  const stripped = rawPath.startsWith(base) ? rawPath.slice(base.length) : rawPath.replace(/^\//, '')
  return stripped.split('/')[0] || ''
}

// Round-robin schedule builder — returns array of matchweeks, each an array of { teamA, teamB }
const buildRoundRobinSchedule = (teamIds, cycles) => {
  if (teamIds.length < 2) return []
  // For odd number of teams, add a null "bye" slot to make the count even
  const teams = teamIds.length % 2 === 1 ? [...teamIds, null] : [...teamIds]
  const m = teams.length
  const matchweeksPerCycle = m - 1
  const schedule = []
  for (let cycle = 0; cycle < cycles; cycle++) {
    const rotation = teams.slice(1) // elements 1..m-1, will be rotated
    for (let round = 0; round < matchweeksPerCycle; round++) {
      const circle = [teams[0], ...rotation]
      const matchweek = []
      for (let i = 0; i < m / 2; i++) {
        const a = circle[i]
        const b = circle[m - 1 - i]
        if (a !== null && b !== null) matchweek.push({ teamA: a, teamB: b })
      }
      schedule.push(matchweek)
      // Rotate: last element moves to front
      rotation.unshift(rotation.pop())
    }
  }
  return schedule
}

const getCoachIdFromUrl = () => {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('coach') ?? null
}

// ─── Coach login screen ───────────────────────────────────────────────────────
const CoachLoginScreen = ({ onSelect }) => {
  const [selectedId, setSelectedId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const handleLogin = () => {
    if (!selectedId) { setError(true); return }
    if (selectedId === COACH_ALL) {
      if (password === ADMIN_PASSWORD) { onSelect(COACH_ALL) }
      else { setError(true); setPassword('') }
      return
    }
    const coach = COACHES.find((c) => c.id === selectedId)
    if (!coach) { setError(true); return }
    if (password === coach.password) { onSelect(selectedId) }
    else { setError(true); setPassword('') }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-green-50 px-6"
      data-testid="coach-select-screen"
    >
      <img src={soccerZoneLogo} alt="Soccer Zone" className="h-20 w-20 rounded-full object-cover shadow-md" />
      <h1 className="text-2xl font-bold text-gray-800">Soccer Zone</h1>

      <div className="w-full max-w-xs space-y-3">
        <select
          value={selectedId}
          onChange={(e) => { setSelectedId(e.target.value); setError(false) }}
          data-testid="coach-login-select"
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base text-gray-800 focus:border-green-500 focus:outline-none"
        >
          <option value="">בחר משתמש...</option>
          {COACHES.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value={COACH_ALL}>Admin / כל הליגות</option>
        </select>

        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleLogin() }}
          placeholder="סיסמה"
          data-testid="coach-login-password"
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-green-500 focus:outline-none"
          dir="ltr"
        />

        {error && (
          <p className="text-center text-sm text-red-500" data-testid="coach-login-error">
            סיסמה שגויה — נסה שוב
          </p>
        )}

        <button
          type="button"
          onClick={handleLogin}
          data-testid="coach-login-submit"
          className="w-full rounded-2xl bg-green-600 py-3 text-base font-bold text-white hover:bg-green-700"
        >
          כניסה
        </button>
      </div>
    </div>
  )
}

// ─── LITE: password screen ────────────────────────────────────────────────────
const LitePasswordScreen = ({ onAuthenticate }) => {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const tryAuth = async () => {
    const ok = await onAuthenticate(password)
    if (!ok) {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-green-50 px-6"
      data-testid="lite-password-screen"
    >
      <div className="text-6xl">⚽</div>
      <h1 className="text-2xl font-bold text-gray-800">Soccer Lite</h1>
      <div className="w-full max-w-xs space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') tryAuth() }}
          placeholder="League password"
          data-testid="lite-password-input"
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-green-500 focus:outline-none"
          dir="ltr"
          autoFocus
        />
        {error && (
          <p className="text-center text-sm text-red-500" data-testid="lite-password-error">
            Wrong password — try again
          </p>
        )}
        <button
          type="button"
          onClick={tryAuth}
          data-testid="lite-password-submit"
          className="w-full rounded-2xl bg-green-600 py-3 text-base font-bold text-white hover:bg-green-700"
        >
          Enter
        </button>
      </div>
    </div>
  )
}

// ─── LITE: league creation screen ─────────────────────────────────────────────
const LiteLeagueSetup = ({ slug, onCreated, createLeague }) => {
  const [superPass, setSuperPass] = useState('')
  const [leagueName, setLeagueName] = useState(slug)
  const [leaguePass, setLeaguePass] = useState('')
  const [error, setError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (superPass !== LITE_SUPER_PASSWORD) { setError('Invalid super password'); return }
    if (!leaguePass.trim()) { setError('League password is required'); return }
    setIsCreating(true)
    const hash = await hashPassword(leaguePass.trim())
    createLeague({
      id: slug,
      name: leagueName.trim() || slug,
      type: LEAGUE_TYPES.tournament,
      adminPassword: hash,
    })
    onCreated(hash)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-green-50 px-6"
      data-testid="lite-setup-screen"
    >
      <div className="text-6xl">⚽</div>
      <h1 className="text-2xl font-bold text-gray-800">Soccer Lite</h1>
      <p className="text-center text-sm text-gray-600">
        League <strong className="font-semibold text-gray-800">{slug}</strong> doesn&apos;t exist yet. Create it below.
      </p>
      <div className="w-full max-w-xs space-y-3">
        <input
          value={leagueName}
          onChange={(e) => { setLeagueName(e.target.value); setError('') }}
          placeholder="League display name"
          data-testid="lite-setup-name"
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-green-500 focus:outline-none"
        />
        <input
          type="password"
          value={leaguePass}
          onChange={(e) => { setLeaguePass(e.target.value); setError('') }}
          placeholder="League password (share with your group)"
          data-testid="lite-setup-league-pass"
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-green-500 focus:outline-none"
          dir="ltr"
        />
        <input
          type="password"
          value={superPass}
          onChange={(e) => { setSuperPass(e.target.value); setError('') }}
          placeholder="Super password (admin only)"
          data-testid="lite-setup-super-pass"
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-green-500 focus:outline-none"
          dir="ltr"
        />
        {error && (
          <p className="text-center text-sm text-red-500" data-testid="lite-setup-error">{error}</p>
        )}
        <button
          type="button"
          onClick={handleCreate}
          disabled={isCreating}
          data-testid="lite-setup-submit"
          className="w-full rounded-2xl bg-green-600 py-3 text-base font-bold text-white hover:bg-green-700 disabled:opacity-50"
        >
          Create League
        </button>
      </div>
    </div>
  )
}

// ─── Auto-schedule drawer ─────────────────────────────────────────────────────
const ScheduleDrawer = ({ leagueName, numTeams, onConfirm, onSkip }) => {
  const today = new Date().toISOString().slice(0, 10)
  const [rounds, setRounds] = useState(1)
  const [includeFinal, setIncludeFinal] = useState(false)
  const [cadence, setCadence] = useState(7)
  const [startDate, setStartDate] = useState(today)

  const roundsPerCycle = numTeams > 1 ? numTeams - 1 : 1
  const totalStubs = rounds * roundsPerCycle + (includeFinal ? 1 : 0)

  const handleConfirm = () => onConfirm({ rounds, includeFinal, cadence, startDate, numTeams })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" data-testid="schedule-drawer">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-base font-bold">📅 תכנון מחזורים</h2>
        <p className="mb-4 text-xs text-gray-500">{leagueName}</p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">מספר מחזורים</label>
            <input
              type="number"
              min={1}
              max={20}
              value={rounds}
              onChange={(e) => setRounds(Math.max(1, Math.min(20, Number(e.target.value))))}
              data-testid="schedule-rounds"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeFinal}
              onChange={(e) => setIncludeFinal(e.target.checked)}
              data-testid="schedule-final"
              className="h-4 w-4"
            />
            כולל גמר (מחזור נוסף בסוף)
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">קצב</label>
            <div className="flex gap-2">
              {[{ v: 7, label: 'שבועי' }, { v: 14, label: 'דו-שבועי' }].map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCadence(v)}
                  data-testid={`schedule-cadence-${v}`}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-all ${cadence === v ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 bg-gray-50 text-gray-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">תאריך התחלה</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value || today)}
              data-testid="schedule-start-date"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            data-testid="schedule-confirm"
            className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            צור {totalStubs} מחזורים
          </button>
          <button
            type="button"
            onClick={onSkip}
            data-testid="schedule-skip"
            className="rounded-xl border px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            דלג
          </button>
        </div>
      </div>
    </div>
  )
}

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
    setTournaments,
  } = useAppContext()
  const [page, setPage] = useState('live')
  const [newLeagueName, setNewLeagueName] = useState('')
  const [newLeagueType, setNewLeagueType] = useState(LEAGUE_TYPES.tournament)
  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false)
  const [pendingLeagueId, setPendingLeagueId] = useState(null)
  const [pendingLeagueName, setPendingLeagueName] = useState('')
  const [pendingNumTeams, setPendingNumTeams] = useState(0)
  const didHydrateLeagueFromUrlRef = useRef(false)
  // Capture the ?league= URL param once at mount so URL-shared leagues stay visible
  const [urlLeagueId] = useState(() => getLeagueIdFromUrl())

  // ── LITE: slug from URL path (once at mount) ─────────────────────────────────
  const [liteSlug] = useState(() => (IS_LITE_MODE ? getLeagueSlugFromPath() : ''))
  // Set to true when the user manually enters the correct league password via the form.
  // Separate from URL/localStorage auth so we never call setState inside an effect.
  const [liteManualAuth, setLiteManualAuth] = useState(false)
  // SHA-256 hash of the ?pass= URL param (computed async at mount). Null until ready.
  const [liteUrlPassHash, setLiteUrlPassHash] = useState(null)
  // True once we've finished hashing the URL pass (or immediately if there's no URL pass).
  const [liteUrlPassReady, setLiteUrlPassReady] = useState(false)

  // ── Coach selection ──────────────────────────────────────────────────────────
  // In lite mode there are no coaches — always treat as admin so edit actions work
  const [activeCoachId, setActiveCoachId] = useState(() => {
    if (IS_LITE_MODE) return COACH_ALL
    return getCoachIdFromUrl() ?? localStorage.getItem(COACH_SESSION_KEY) ?? COACH_ALL
  })

  const handleSelectCoach = (coachId) => {
    localStorage.setItem(COACH_SESSION_KEY, coachId)
    setActiveCoachId(coachId)
  }

  const handleSwitchCoach = () => {
    localStorage.removeItem(COACH_SESSION_KEY)
    setActiveCoachId(null)
  }

  // Admin mode: any logged-in user has full editing rights.
  // Admin (COACH_ALL) additionally sees all leagues; named coaches see their slice.
  const adminMode = !!activeCoachId

  // Leagues visible to the current coach.
  // Admin sees everything. Named coach sees:
  //   - leagues with no coachId (unassigned → visible to all coaches)
  //   - leagues assigned to them specifically
  //   - also always shows any ?league= URL param league (for link sharing)
  const visibleLeagues = useMemo(() => {
    if (!activeCoachId || activeCoachId === COACH_ALL) return leagues
    const coachLeagues = leagues.filter((l) => !l.coachId || l.coachId === activeCoachId)
    if (urlLeagueId && !coachLeagues.some((l) => l.id === urlLeagueId)) {
      const linked = leagues.find((l) => l.id === urlLeagueId)
      if (linked) return [...coachLeagues, linked]
    }
    return coachLeagues
  }, [leagues, activeCoachId, urlLeagueId])

  const activeCoachName = COACHES.find((c) => c.id === activeCoachId)?.name ?? null

  // ── LITE: hash the ?pass= URL param once at mount ───────────────────────────
  useEffect(() => {
    if (!IS_LITE_MODE) { setLiteUrlPassReady(true); return }
    const urlPass = new URLSearchParams(window.location.search).get('pass')
    if (!urlPass) { setLiteUrlPassReady(true); return }
    hashPassword(urlPass).then((hash) => {
      setLiteUrlPassHash(hash)
      setLiteUrlPassReady(true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // If active league isn't visible to current coach, switch to first visible one
  useEffect(() => {
    if (!activeCoachId) return
    if (visibleLeagues.length === 0) return
    if (visibleLeagues.some((l) => l.id === activeLeagueId)) return
    setActiveLeagueId(visibleLeagues[0].id)
  }, [activeCoachId, visibleLeagues, activeLeagueId, setActiveLeagueId])

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

  // ── URL ↔ active league sync (soccer-zone only) ──────────────────────────────
  useEffect(() => {
    if (IS_LITE_MODE) return // league comes from the URL path, not ?league=
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
    if (IS_LITE_MODE) return // URL is path-based in lite mode
    if (leagues.length === 0) return
    if (!didHydrateLeagueFromUrlRef.current) return
    syncLeagueIdToUrl(activeLeagueId)
  }, [activeLeagueId, leagues])

  // ── LITE: lock activeLeagueId to the path slug ───────────────────────────────
  // IS_LITE_MODE is a build-time constant, not a reactive value — excluded from deps
  useEffect(() => {
    if (!IS_LITE_MODE || !liteSlug || isLoading || leagues.length === 0) return
    if (activeLeagueId !== liteSlug) setActiveLeagueId(liteSlug)
  }, [liteSlug, isLoading, leagues, activeLeagueId, setActiveLeagueId])

  // ── LITE: derived auth state (no setState in effect) ─────────────────────────
  // Computes auth status synchronously from loaded leagues + URL hash/localStorage.
  // liteUrlPassReady gates the check so we don't flash the password screen while
  // the URL pass hash is still being computed.
  const liteAuthResult = useMemo(() => {
    if (!IS_LITE_MODE || isLoading || !liteUrlPassReady) return { checked: false, urlPassHash: null, authenticated: false }
    const league = leagues.find((l) => l.id === liteSlug)
    if (!league) return { checked: true, urlPassHash: null, authenticated: false }
    const cached = localStorage.getItem(`lite-pass-${liteSlug}`)
    const byUrl = Boolean(liteUrlPassHash && liteUrlPassHash === league.adminPassword)
    const byCached = Boolean(cached && cached === league.adminPassword)
    return { checked: true, urlPassHash: byUrl ? liteUrlPassHash : null, authenticated: byUrl || byCached }
  }, [isLoading, liteUrlPassReady, liteUrlPassHash, leagues, liteSlug])

  const liteAuthChecked = liteAuthResult.checked
  const liteAuthenticated = liteAuthResult.authenticated || liteManualAuth

  // Cache the URL-provided pass hash in localStorage so future visits don't need ?pass=
  useEffect(() => {
    if (!liteAuthResult.urlPassHash) return
    localStorage.setItem(`lite-pass-${liteSlug}`, liteAuthResult.urlPassHash)
  }, [liteAuthResult.urlPassHash, liteSlug])

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
    const leagueId = `league-${Date.now()}`
    const name = newLeagueName.trim()
    createLeague({ id: leagueId, name, type: newLeagueType })
    setNewLeagueName('')
    setNewLeagueType(LEAGUE_TYPES.tournament)
  }

  // Called from LiveTournament — opens the schedule drawer for the active regular league
  const handleOpenScheduleDrawer = (numTeams) => {
    if (!activeLeague) return
    setPendingLeagueId(activeLeague.id)
    setPendingLeagueName(activeLeague.name)
    setPendingNumTeams(numTeams)
    setScheduleDrawerOpen(true)
  }

  const handleConfirmSchedule = ({ rounds, includeFinal, cadence, startDate, numTeams }) => {
    if (!pendingLeagueId) return
    const roundsPerCycle = numTeams > 1 ? numTeams - 1 : 1
    const totalRounds = rounds * roundsPerCycle + (includeFinal ? 1 : 0)
    const base = startDate || new Date().toISOString().slice(0, 10)
    const now = Date.now()

    // Build round-robin pairings for the regular (non-final) matchweeks
    const leagueTeams = leagues.find((l) => l.id === pendingLeagueId)?.teams ?? []
    const teamIds = leagueTeams.map((t) => t.id)
    const rrSchedule = buildRoundRobinSchedule(teamIds, rounds) // array of matchweeks

    const buildStubs = (existingMax) =>
      Array.from({ length: totalRounds }, (_, i) => {
        const d = new Date(base)
        d.setDate(d.getDate() + i * cadence)
        const date = d.toISOString().slice(0, 10)
        const isFinalGame = i === totalRounds - 1 && includeFinal
        const matchweekGames = isFinalGame ? [] : (rrSchedule[i] ?? []).map((pair, gi) => ({
          id: `game-${now + i}-${gi}`,
          round: i + 1,
          teamA: pair.teamA,
          teamB: pair.teamB,
          score: { a: 0, b: 0 },
          played: false,
          events: [],
        }))
        return {
          id: `${pendingLeagueId}-${now + i}`,
          name: isFinalGame ? 'גמר' : '',
          date,
          leagueNumber: existingMax + i + 1,
          leagueId: pendingLeagueId,
          year: new Date(date).getFullYear(),
          teams: leagueTeams.map((t) => ({ ...t, players: [...(t.players ?? [])] })),
          games: matchweekGames,
        }
      })

    // Use the functional updater so existingMax is computed from the latest state,
    // not from the render-closure snapshot (avoids all-1 bug when state changed mid-drawer)
    setTournaments((prev) => {
      const existingMax = prev
        .filter((t) => t.leagueId === pendingLeagueId)
        .reduce((max, t) => Math.max(max, t.leagueNumber ?? 0), 0)
      return [...prev, ...buildStubs(existingMax)]
    })
    setScheduleDrawerOpen(false)
    setPendingLeagueId(null)
    setPendingLeagueName('')
    setPendingNumTeams(0)
  }

  const handleSkipSchedule = () => {
    setScheduleDrawerOpen(false)
    setPendingLeagueId(null)
    setPendingLeagueName('')
    setPendingNumTeams(0)
  }

  const handleLeagueMetaChange = (field, value) => {
    if (!activeLeague) return
    setLeagues((current) =>
      current.map((league) =>
        league.id === activeLeague.id ? { ...league, [field]: value } : league,
      ),
    )
  }

  // ── Early returns ────────────────────────────────────────────────────────────

  // Soccer-zone: show coach login if no coach selected
  if (!IS_LITE_MODE && !activeCoachId) {
    return <CoachLoginScreen onSelect={handleSelectCoach} />
  }

  // Lite: show loading / wait for auth check
  if (IS_LITE_MODE && (isLoading || !liteAuthChecked)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-green-50" data-testid="lite-loading">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    )
  }

  // Lite: league not found → offer to create it
  if (IS_LITE_MODE && !leagues.some((l) => l.id === liteSlug)) {
    return (
      <LiteLeagueSetup
        slug={liteSlug}
        onCreated={(hash) => {
          localStorage.setItem(`lite-pass-${liteSlug}`, hash)
          setLiteManualAuth(true)
        }}
        createLeague={createLeague}
      />
    )
  }

  // Lite: league exists but not authenticated → password screen
  if (IS_LITE_MODE && !liteAuthenticated) {
    const league = leagues.find((l) => l.id === liteSlug)
    return (
      <LitePasswordScreen
        onAuthenticate={async (pass) => {
          const hash = await hashPassword(pass)
          if (hash === league?.adminPassword) {
            localStorage.setItem(`lite-pass-${liteSlug}`, hash)
            setLiteManualAuth(true)
            return true
          }
          return false
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-green-50">
      {/* <WhatsNew adminMode={adminMode} /> */}
      {scheduleDrawerOpen && (
        <ScheduleDrawer
          leagueName={pendingLeagueName}
          numTeams={pendingNumTeams}
          onConfirm={handleConfirmSchedule}
          onSkip={handleSkipSchedule}
        />
      )}

      {/* Compact sticky header */}
      <header className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-3 py-2">
          {IS_LITE_MODE ? (
            /* Lite: logo-free, league name as plain text */
            <>
              <span className="text-2xl">⚽</span>
              <span
                className="min-w-0 flex-1 truncate text-base font-semibold text-gray-800"
                data-testid="lite-league-name"
              >
                {activeLeague?.name ?? liteSlug}
              </span>
            </>
          ) : (
            /* Soccer-zone: logo + league selector + coach badge */
            <>
              <img src={soccerZoneLogo} alt="Soccer Zone FC" className="h-12 w-12 shrink-0 rounded-full object-cover" />
              <select
                value={activeLeagueId}
                onChange={(event) => setActiveLeagueId(event.target.value)}
                data-testid="league-select"
                className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-base font-semibold"
              >
                {visibleLeagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name} ({getLeagueTypeLabel(league.type)})
                  </option>
                ))}
              </select>
              {activeCoachName ? (
                <button
                  type="button"
                  onClick={handleSwitchCoach}
                  data-testid="coach-badge"
                  title="החלף מאמן"
                  className="shrink-0 rounded-xl border border-green-200 bg-green-50 px-2 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100"
                >
                  {activeCoachName} ↩
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSwitchCoach}
                  data-testid="coach-badge"
                  title="בחר מאמן"
                  className="shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
                >
                  מאמן אחר ↩
                </button>
              )}
            </>
          )}
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
          <LiveTournament adminMode={adminMode} onOpenScheduleDrawer={handleOpenScheduleDrawer} />
        ) : page === 'stats' ? (
          <Stats />
        ) : (
          /* Admin panel page — soccer-zone only (hidden in lite via nav) */
          <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="management-panel">
            <h2 className="text-base font-bold">אזור ניהול וכלי מערכת</h2>
            <p className="mt-1 text-sm text-gray-600">פעולות הניהול למטה עובדות על הליגה הנבחרת בלבד.</p>

            <div className="mt-3 flex flex-wrap gap-2">
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
              <div className="mt-4 rounded-xl border p-3">
                <h3 className="mb-3 text-sm font-semibold text-gray-800">הגדרות ליגה פעילה</h3>
                <div className="grid gap-3 md:grid-cols-3">
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
                  {/* Coach assignment */}
                  <select
                    value={activeLeague.coachId ?? ''}
                    onChange={(e) => handleLeagueMetaChange('coachId', e.target.value || null)}
                    data-testid="league-coach-select"
                    className="rounded-xl border px-3 py-2 text-sm md:col-span-3"
                  >
                    <option value="">ללא מאמן מוגדר (גלוי לכולם)</option>
                    {COACHES.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
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
        {/* Admin tab — soccer-zone only; lite mode has no admin panel */}
        {!IS_LITE_MODE && (
          <NavTab
            icon={adminMode ? '🔓' : '🔒'}
            label="ניהול"
            active={page === 'admin'}
            onClick={() => setPage('admin')}
            testId="nav-admin"
          />
        )}
      </nav>
    </div>
  )
}

export default App
