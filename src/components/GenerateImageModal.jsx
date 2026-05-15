import html2canvas from 'html2canvas'
import { useRef, useState } from 'react'
import { buildOverlayData, buildPrompt } from '../gen-ai/buildPrompt'
import { generateImage } from '../gen-ai/geminiService'

const STATS_OPTIONS = [
  { id: 'winning-team', label: 'קבוצת השבוע', description: 'תמונה חגיגית לקבוצה המנצחת', icon: '🏆' },
  { id: 'mvp', label: 'שחקן MVP', description: 'ספוטלייט דרמטי לשחקן הכי טוב', icon: '⭐' },
  { id: 'stats-table', label: 'טבלת סטטיסטיקות', description: 'אינפוגרפיקה מעוצבת עם כל הנתונים', icon: '📊' },
]

const LIVE_OPTIONS = [
  { id: 'winning-team', label: 'קבוצת השבוע', description: 'תמונה חגיגית לקבוצה המנצחת', icon: '🏆' },
  { id: 'mvp', label: 'שחקן MVP', description: 'ספוטלייט דרמטי לשחקן הכי טוב', icon: '⭐' },
  { id: 'day-results', label: 'תוצאות היום', description: 'פוסטר תוצאות וטבלת מצב', icon: '📋' },
]

const optionsForMode = (mode) => {
  if (mode === 'live') return LIVE_OPTIONS
  if (mode === 'squads') return []
  return STATS_OPTIONS
}

const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
  </svg>
)

// ── Overlay renderers ────────────────────────────────────────────────────────

// Shared card row for stats-table: transparent left/right edges reveal AI silhouette + icon;
// only the center 60% gets a dark background for legible text.
const StatCard = ({ label, name, value, icon }) => (
  <div className="flex h-full items-center">
    {/* Left 22%: transparent — AI silhouette shows through */}
    <div className="w-[22%]" />
    {/* Center 56%: dark text zone */}
    <div className="w-[56%] rounded-lg bg-black/75 px-3 py-2 text-right" dir="rtl">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="text-base font-bold leading-tight text-white">{name}</div>
      <div className="text-xl font-black text-yellow-400">{value} {icon}</div>
    </div>
    {/* Right 22%: transparent — AI icon shows through */}
    <div className="w-[22%]" />
  </div>
)

const OverlayWinningTeam = ({ data }) => (
  // Trophy is centered in the AI background — keep text at bottom 35%
  <div className="flex h-full flex-col">
    <div className="flex-1" /> {/* top 65%: transparent, let AI trophy show */}
    <div className="mx-6 mb-6 rounded-xl bg-black/75 py-4 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-yellow-300">קבוצת השבוע</div>
      <div className="text-3xl font-black text-white">{data.teamName}</div>
      <div className="mt-1 flex justify-center gap-8">
        <div>
          <div className="text-xl font-bold text-yellow-400">{data.wins}</div>
          <div className="text-[10px] text-gray-400">ניצחונות</div>
        </div>
        <div>
          <div className="text-xl font-bold text-yellow-400">{data.points}</div>
          <div className="text-[10px] text-gray-400">נקודות</div>
        </div>
      </div>
      <div className="mt-1 text-[9px] text-gray-500">{data.leagueName}</div>
    </div>
  </div>
)

const OverlayMvp = ({ data }) => (
  // AI has player silhouette centered, darker top/bottom bands
  <div className="flex h-full flex-col justify-between px-6 py-5">
    <div className="rounded-xl bg-black/75 py-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-yellow-300">⭐ שחקן MVP</div>
      <div className="text-3xl font-black text-white">{data.name}</div>
      <div className="text-[9px] text-gray-400">{data.leagueName}</div>
    </div>
    <div className="flex-1" /> {/* center: transparent — AI spotlight/silhouette */}
    <div className="rounded-xl bg-black/75 py-3">
      <div className="flex justify-center gap-8 text-center">
        <div>
          <div className="text-2xl font-black text-yellow-400">{data.goals}</div>
          <div className="text-[10px] text-gray-400">שערים ⚽</div>
        </div>
        <div>
          <div className="text-2xl font-black text-yellow-400">{data.assists}</div>
          <div className="text-[10px] text-gray-400">בישולים 🎯</div>
        </div>
        <div>
          <div className="text-2xl font-black text-yellow-400">{data.wins}</div>
          <div className="text-[10px] text-gray-400">ניצחונות</div>
        </div>
      </div>
    </div>
  </div>
)

const OverlayStatsTable = ({ data }) => (
  // AI layout: top 10% header | 3 cards × 22% | bottom 24% table
  <div className="flex h-full flex-col" dir="rtl">
    {/* Header band — 10% */}
    <div className="flex h-[10%] items-center justify-center bg-black/60">
      <span className="text-[11px] font-semibold tracking-widest text-yellow-300">
        סטטיסטיקות עונה — {data.leagueName}
      </span>
    </div>

    {/* 3 stat cards — each 22% */}
    <div className="h-[22%]">
      <StatCard label="מלך שערים 🥅" name={data.topScorer?.name ?? '-'} value={data.topScorer?.goals ?? 0} icon="" />
    </div>
    <div className="h-[22%]">
      <StatCard label="מלך בישולים 🎯" name={data.topAssister?.name ?? '-'} value={data.topAssister?.assists ?? 0} icon="" />
    </div>
    <div className="h-[22%]">
      <StatCard label="🏆 MVP" name={data.mvpName ?? '-'} value="" icon="" />
    </div>

    {/* Standings — bottom 24% */}
    <div className="flex h-[24%] flex-col justify-center bg-black/65 px-6">
      {data.top3.map((r, i) => (
        <div key={r.teamName} className="flex items-center justify-between py-0.5 text-sm">
          <span className="text-gray-300 text-xs">{r.points} נק׳</span>
          <span className="font-semibold text-white text-sm">{r.teamName}</span>
          <span>{['🥇', '🥈', '🥉'][i]}</span>
        </div>
      ))}
    </div>
  </div>
)

const OverlayDayResults = ({ data }) => (
  // AI layout: top third action/ball | middle third empty | bottom third table
  <div className="flex h-full flex-col">
    {/* Top third: transparent — AI action elements */}
    <div className="flex h-[33%] items-center justify-center">
      <div className="rounded-xl bg-black/70 px-6 py-3 text-center">
        <div className="text-2xl font-black text-white">תוצאות היום</div>
        {data.date && <div className="text-xs text-gray-300">{data.date}</div>}
        <div className="text-[10px] text-gray-400">{data.leagueName}</div>
      </div>
    </div>
    {/* Middle third: big number, semi-transparent */}
    <div className="flex h-[33%] items-center justify-center">
      <div className="text-center">
        <div className="text-6xl font-black text-yellow-400 drop-shadow-lg">{data.gamesCount}</div>
        <div className="text-sm text-gray-200">משחקים</div>
      </div>
    </div>
    {/* Bottom third: standings table */}
    {data.top3.length > 0 && (
      <div className="flex h-[34%] flex-col justify-center bg-black/70 px-6" dir="rtl">
        {data.top3.map((r, i) => (
          <div key={r.teamName} className="flex items-center justify-between py-0.5 text-sm">
            <span className="text-gray-300 text-xs">{r.points} נק׳</span>
            <span className="font-semibold text-white">{r.teamName}</span>
            <span>{['🥇', '🥈', '🥉'][i]}</span>
          </div>
        ))}
      </div>
    )}
  </div>
)

const OverlaySquads = ({ data }) => (
  // AI has vertical columns with dark interiors — overlay text inside each column
  <div className="flex h-full flex-col p-3" dir="rtl">
    <div className="mb-2 text-center text-xs font-semibold text-yellow-300">{data.leagueName} — סגלי קבוצות</div>
    <div className="flex flex-1 gap-2">
      {data.teams.map((team) => (
        <div key={team.name} className="flex-1 rounded-lg bg-black/75 px-2 py-2">
          <div className="mb-1 border-b border-yellow-600/40 pb-1 text-sm font-bold text-yellow-300">{team.name}</div>
          {team.players.map((name) => (
            <div key={name} className="text-[11px] leading-5 text-gray-200">{name}</div>
          ))}
        </div>
      ))}
    </div>
  </div>
)

const OverlayContent = ({ type, data }) => {
  if (!data) return null
  if (type === 'winning-team') return <OverlayWinningTeam data={data} />
  if (type === 'mvp') return <OverlayMvp data={data} />
  if (type === 'stats-table') return <OverlayStatsTable data={data} />
  if (type === 'day-results') return <OverlayDayResults data={data} />
  if (type === 'squads') return <OverlaySquads data={data} />
  return null
}

// ── Modal ────────────────────────────────────────────────────────────────────

const GenerateImageModal = ({
  onClose,
  mode = 'stats',
  stats = [],
  leaders = {},
  standings = [],
  league = null,
  session = null,
  players = [],
}) => {
  const options = optionsForMode(mode)
  const isSquadsMode = mode === 'squads'

  const initialSelected = isSquadsMode ? 'squads' : null
  const [selected, setSelected] = useState(initialSelected)
  const [promptText, setPromptText] = useState(() => buildPrompt(isSquadsMode ? 'squads' : null))
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [imageSrc, setImageSrc] = useState(null)
  const [error, setError] = useState(null)
  const resultRef = useRef(null)

  const dataProps = { stats, leaders, standings, league, session, players }

  const handleSelectOption = (id) => {
    setSelected(id)
    setPromptText(buildPrompt(id, dataProps))
    setShowEditPrompt(false)
  }

  const handleGenerate = async () => {
    if (!selected || !promptText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const src = await generateImage(promptText.trim())
      setImageSrc(src)
    } catch (err) {
      setError(err.message ?? 'שגיאה בייצור התמונה')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!resultRef.current) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(resultRef.current, { useCORS: true, scale: 2 })
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `soccer-zone-${selected}.png`
      a.click()
    } finally {
      setDownloading(false)
    }
  }

  const handleBack = () => {
    setImageSrc(null)
    setError(null)
  }

  const overlayData = selected ? buildOverlayData(selected, dataProps) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      data-testid="generate-image-modal"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {isSquadsMode ? '✨ ייצר תמונת סגלים' : '✨ ייצר תמונה AI'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="generate-image-close"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {!imageSrc && !loading ? (
          <>
            {/* Option picker */}
            {!isSquadsMode && (
              <>
                <p className="mb-3 text-sm text-gray-500">בחר סוג תמונה לייצור:</p>
                <div className="mb-4 space-y-2">
                  {options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectOption(opt.id)}
                      data-testid={`generate-option-${opt.id}`}
                      className={`w-full rounded-xl border-2 p-3 text-right transition-all ${
                        selected === opt.id
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{opt.icon}</span>
                        <div>
                          <div className="font-semibold text-gray-800">{opt.label}</div>
                          <div className="text-xs text-gray-500">{opt.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Edit prompt drawer */}
            {selected && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowEditPrompt((v) => !v)}
                  data-testid="edit-prompt-toggle"
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                >
                  <PencilIcon />
                  <span>{showEditPrompt ? 'סגור עריכת פרומפט' : 'ערוך פרומפט'}</span>
                </button>
                {showEditPrompt && (
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    data-testid="edit-prompt-textarea"
                    rows={6}
                    className="mt-2 w-full rounded-lg border border-gray-300 p-2 text-xs text-gray-700 focus:border-green-400 focus:outline-none"
                    dir="ltr"
                  />
                )}
              </div>
            )}

            {error && (
              <div
                className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                data-testid="generate-error"
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!selected}
              data-testid="generate-submit"
              className="w-full rounded-xl bg-green-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40 hover:bg-green-700"
            >
              ייצר תמונה
            </button>
            <p className="mt-2 text-center text-xs text-gray-400">מופעל על ידי Gemini AI</p>
          </>
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 py-10" data-testid="generate-loading">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
            <p className="text-sm text-gray-500">מייצר תמונה...</p>
          </div>
        ) : (
          <>
            {/* Result: background image + Hebrew data overlay */}
            <div
              ref={resultRef}
              data-testid="generate-result-image"
              className="relative mb-4 overflow-hidden rounded-xl"
              style={{ aspectRatio: '1 / 1' }}
            >
              <img src={imageSrc} alt="רקע" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 text-white" dir="rtl">
                <OverlayContent type={selected} data={overlayData} />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                data-testid="generate-download"
                className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60 hover:bg-green-700"
              >
                {downloading ? 'מוריד...' : 'הורד תמונה'}
              </button>
              <button
                type="button"
                onClick={handleBack}
                data-testid="generate-back"
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                חזור
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default GenerateImageModal
