import html2canvas from 'html2canvas'
import { useRef, useState } from 'react'
import { buildOverlayData, buildPrompt, OVERLAY_FIELDS } from '../gen-ai/buildPrompt'
import { generateImage, generateImageWithPhoto } from '../gen-ai/geminiService'

// ── Constants ────────────────────────────────────────────────────────────────

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

// Team color name → CSS hex
const TEAM_COLOR_CSS = {
  black: '#374151', white: '#e5e7eb', yellow: '#eab308', red: '#ef4444',
  blue: '#3b82f6', green: '#22c55e', pink: '#ec4899', orange: '#f97316',
  purple: '#a855f7', gray: '#6b7280',
}

const defaultOverlayConfig = (type, overlayData) => {
  if (type === 'squads') {
    return Object.fromEntries((overlayData?.teams ?? []).map((t) => [t.name, true]))
  }
  return Object.fromEntries((OVERLAY_FIELDS[type] ?? []).map((f) => [f.key, true]))
}

// ── Overlay renderers ────────────────────────────────────────────────────────

const StatCard = ({ label, name, value }) => (
  <div className="flex h-full items-center">
    <div className="w-[22%]" />
    <div className="w-[56%] rounded-lg bg-black/75 px-3 py-2 text-right" dir="rtl">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="text-base font-bold leading-tight text-white">{name}</div>
      {value !== '' && value != null && (
        <div className="text-xl font-black text-yellow-400">{value}</div>
      )}
    </div>
    <div className="w-[22%]" />
  </div>
)

const OverlayWinningTeam = ({ data, config = {} }) => (
  <div className="flex h-full flex-col">
    <div className="flex-1" />
    <div className="mx-6 mb-6 rounded-xl bg-black/75 py-4 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-yellow-300">קבוצת השבוע</div>
      {config.teamName !== false && <div className="text-3xl font-black text-white">{data.teamName}</div>}
      {(config.wins !== false || config.points !== false) && (
        <div className="mt-1 flex justify-center gap-8">
          {config.wins !== false && (
            <div>
              <div className="text-xl font-bold text-yellow-400">{data.wins}</div>
              <div className="text-[10px] text-gray-400">ניצחונות</div>
            </div>
          )}
          {config.points !== false && (
            <div>
              <div className="text-xl font-bold text-yellow-400">{data.points}</div>
              <div className="text-[10px] text-gray-400">נקודות</div>
            </div>
          )}
        </div>
      )}
      {config.leagueName !== false && <div className="mt-1 text-[9px] text-gray-500">{data.leagueName}</div>}
    </div>
  </div>
)

const OverlayMvp = ({ data, config = {} }) => (
  <div className="flex h-full flex-col justify-between px-6 py-5">
    <div className="rounded-xl bg-black/75 py-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-yellow-300">⭐ שחקן MVP</div>
      {config.name !== false && <div className="text-3xl font-black text-white">{data.name}</div>}
      {config.leagueName !== false && <div className="text-[9px] text-gray-400">{data.leagueName}</div>}
    </div>
    <div className="flex-1" />
    <div className="rounded-xl bg-black/75 py-3">
      <div className="flex justify-center gap-8 text-center">
        {config.goals !== false && (
          <div>
            <div className="text-2xl font-black text-yellow-400">{data.goals}</div>
            <div className="text-[10px] text-gray-400">שערים ⚽</div>
          </div>
        )}
        {config.assists !== false && (
          <div>
            <div className="text-2xl font-black text-yellow-400">{data.assists}</div>
            <div className="text-[10px] text-gray-400">בישולים 🎯</div>
          </div>
        )}
        {config.wins !== false && (
          <div>
            <div className="text-2xl font-black text-yellow-400">{data.wins}</div>
            <div className="text-[10px] text-gray-400">ניצחונות</div>
          </div>
        )}
      </div>
    </div>
  </div>
)

const OverlayStatsTable = ({ data, config = {} }) => (
  <div className="flex h-full flex-col" dir="rtl">
    <div className="flex h-[10%] items-center justify-center bg-black/60">
      {config.leagueName !== false && (
        <span className="text-[11px] font-semibold tracking-widest text-yellow-300">
          סטטיסטיקות עונה — {data.leagueName}
        </span>
      )}
    </div>
    <div className="h-[22%]">
      {config.topScorer !== false && (
        <StatCard label="מלך שערים 🥅" name={data.topScorer?.name ?? '-'} value={data.topScorer?.goals ?? 0} />
      )}
    </div>
    <div className="h-[22%]">
      {config.topAssister !== false && (
        <StatCard label="מלך בישולים 🎯" name={data.topAssister?.name ?? '-'} value={data.topAssister?.assists ?? 0} />
      )}
    </div>
    <div className="h-[22%]">
      {config.mvpName !== false && data.mvpName && (
        <StatCard label="🏆 MVP" name={data.mvpName} value="" />
      )}
    </div>
    {config.standings !== false && data.top3.length > 0 && (
      <div className="flex h-[24%] flex-col justify-center bg-black/65 px-6">
        {data.top3.map((r, i) => (
          <div key={r.teamName} className="flex items-center justify-between py-0.5 text-sm">
            <span className="text-xs text-gray-300">{r.points} נק׳</span>
            <span className="text-sm font-semibold text-white">{r.teamName}</span>
            <span>{['🥇', '🥈', '🥉'][i]}</span>
          </div>
        ))}
      </div>
    )}
  </div>
)

const OverlayDayResults = ({ data, config = {} }) => (
  <div className="flex h-full flex-col">
    <div className="flex h-[33%] items-center justify-center">
      <div className="rounded-xl bg-black/70 px-6 py-3 text-center">
        <div className="text-2xl font-black text-white">תוצאות היום</div>
        {config.date !== false && data.date && <div className="text-xs text-gray-300">{data.date}</div>}
        <div className="text-[10px] text-gray-400">{data.leagueName}</div>
      </div>
    </div>
    <div className="flex h-[33%] items-center justify-center">
      {config.gamesCount !== false && (
        <div className="text-center">
          <div className="text-6xl font-black text-yellow-400 drop-shadow-lg">{data.gamesCount}</div>
          <div className="text-sm text-gray-200">משחקים</div>
        </div>
      )}
    </div>
    {config.standings !== false && data.top3.length > 0 && (
      <div className="flex h-[34%] flex-col justify-center bg-black/70 px-6" dir="rtl">
        {data.top3.map((r, i) => (
          <div key={r.teamName} className="flex items-center justify-between py-0.5 text-sm">
            <span className="text-xs text-gray-300">{r.points} נק׳</span>
            <span className="font-semibold text-white">{r.teamName}</span>
            <span>{['🥇', '🥈', '🥉'][i]}</span>
          </div>
        ))}
      </div>
    )}
  </div>
)

const OverlaySquads = ({ data, config = {} }) => (
  <div className="flex h-full flex-col p-3" dir="rtl">
    <div className="mb-2 text-center text-xs font-semibold text-yellow-300">{data.leagueName} — סגלי קבוצות</div>
    <div className="flex flex-1 gap-2">
      {data.teams
        .filter((team) => config[team.name] !== false)
        .map((team) => (
          <div
            key={team.name}
            className="flex-1 rounded-lg bg-black/75 px-2 py-2"
            style={{ borderLeft: `3px solid ${TEAM_COLOR_CSS[team.color] ?? '#6b7280'}` }}
          >
            <div className="mb-1 pb-1 text-sm font-bold text-yellow-300">{team.name}</div>
            {team.players.map((name) => (
              <div key={name} className="text-[11px] leading-5 text-gray-200">{name}</div>
            ))}
          </div>
        ))}
    </div>
  </div>
)

const OverlayContent = ({ type, data, config }) => {
  if (!data) return null
  if (type === 'winning-team') return <OverlayWinningTeam data={data} config={config} />
  if (type === 'mvp') return <OverlayMvp data={data} config={config} />
  if (type === 'stats-table') return <OverlayStatsTable data={data} config={config} />
  if (type === 'day-results') return <OverlayDayResults data={data} config={config} />
  if (type === 'squads') return <OverlaySquads data={data} config={config} />
  return null
}

// ── Download / Share helpers ─────────────────────────────────────────────────

const captureResultAsBlob = async (genMode, imageSrc, resultRef) => {
  if (genMode === 'full-ai' || !resultRef?.current) {
    return fetch(imageSrc).then((r) => r.blob())
  }
  const canvas = await html2canvas(resultRef.current, { useCORS: true, scale: 2 })
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
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
  const isSquadsMode = mode === 'squads'
  const options = optionsForMode(mode)
  const dataProps = { stats, leaders, standings, league, session, players }

  // Generation axes
  const [genMode, setGenMode] = useState('bg-text') // 'full-ai' | 'bg-text'
  const [hasPhoto, setHasPhoto] = useState(false)
  const [uploadedPhoto, setUploadedPhoto] = useState(null) // { base64, mimeType, previewUrl }

  // Image type selection
  const [selected, setSelected] = useState(isSquadsMode ? 'squads' : null)

  // Overlay config (Bg+Text mode only)
  const [overlayConfig, setOverlayConfig] = useState(() => {
    if (isSquadsMode) {
      const od = buildOverlayData('squads', dataProps)
      return defaultOverlayConfig('squads', od)
    }
    return {}
  })

  // Prompt
  const [promptText, setPromptText] = useState(() =>
    buildPrompt(isSquadsMode ? 'squads' : null, dataProps, { fullAi: false, hasPhoto: false }),
  )
  const [showEditPrompt, setShowEditPrompt] = useState(false)

  // UI state
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [imageSrc, setImageSrc] = useState(null)
  const [error, setError] = useState(null)
  const resultRef = useRef(null)
  const fileInputRef = useRef(null)

  const recomputePrompt = (type, gm, photo) =>
    buildPrompt(type, dataProps, { fullAi: gm === 'full-ai', hasPhoto: !!photo })

  const handleSelectOption = (id) => {
    setSelected(id)
    setPromptText(recomputePrompt(id, genMode, uploadedPhoto))
    const od = buildOverlayData(id, dataProps)
    setOverlayConfig(defaultOverlayConfig(id, od))
    setShowEditPrompt(false)
  }

  const handleGenModeChange = (gm) => {
    setGenMode(gm)
    if (selected) setPromptText(recomputePrompt(selected, gm, uploadedPhoto))
  }

  const handlePhotoToggle = (on) => {
    setHasPhoto(on)
    if (!on) setUploadedPhoto(null)
    if (selected) setPromptText(recomputePrompt(selected, genMode, on ? uploadedPhoto : null))
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const photo = { base64: dataUrl.split(',')[1], mimeType: file.type, previewUrl: dataUrl }
      setUploadedPhoto(photo)
      if (selected) setPromptText(recomputePrompt(selected, genMode, photo))
    }
    reader.readAsDataURL(file)
  }

  const handleGenerate = async () => {
    if (!selected || !promptText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const src =
        hasPhoto && uploadedPhoto
          ? await generateImageWithPhoto(promptText.trim(), uploadedPhoto.base64, uploadedPhoto.mimeType)
          : await generateImage(promptText.trim())
      setImageSrc(src)
    } catch (err) {
      setError(err.message ?? 'שגיאה בייצור התמונה')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!imageSrc) return
    setDownloading(true)
    try {
      const blob = await captureResultAsBlob(genMode, imageSrc, resultRef)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `soccer-zone-${selected}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setDownloading(false)
    }
  }

  const handleShare = async () => {
    if (!imageSrc) return
    try {
      const blob = await captureResultAsBlob(genMode, imageSrc, resultRef)
      const file = new File([blob], `soccer-zone-${selected}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      }
    } catch {
      // cancelled or not supported
    }
  }

  const handleBack = () => {
    setImageSrc(null)
    setError(null)
  }

  const overlayData = selected ? buildOverlayData(selected, dataProps) : null
  const squadsFields = overlayData?.teams?.map((t) => ({ key: t.name, label: t.name })) ?? []
  const checkboxFields = selected === 'squads' ? squadsFields : (OVERLAY_FIELDS[selected] ?? [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      data-testid="generate-image-modal"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
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
            {/* Type picker */}
            {!isSquadsMode && (
              <>
                <p className="mb-2 text-sm text-gray-500">בחר סוג תמונה לייצור:</p>
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

            {/* Generation mode + photo toggle row */}
            <div className="mb-3 flex items-center gap-2">
              {/* Gen mode tabs */}
              <div className="flex flex-1 rounded-lg border border-gray-200 p-0.5 text-xs">
                {[['full-ai', 'מלא AI'], ['bg-text', 'רקע + טקסט']].map(([gm, label]) => (
                  <button
                    key={gm}
                    type="button"
                    onClick={() => handleGenModeChange(gm)}
                    data-testid={`gen-mode-${gm}`}
                    className={`flex-1 rounded-md py-1.5 font-medium transition-all ${
                      genMode === gm ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Photo toggle */}
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:border-gray-300">
                <input
                  type="checkbox"
                  checked={hasPhoto}
                  onChange={(e) => handlePhotoToggle(e.target.checked)}
                  data-testid="photo-toggle"
                  className="accent-green-600"
                />
                📷 תמונה
              </label>
            </div>

            {/* Photo upload */}
            {hasPhoto && (
              <div className="mb-3">
                {uploadedPhoto ? (
                  <div className="relative overflow-hidden rounded-xl border border-gray-200">
                    <img src={uploadedPhoto.previewUrl} alt="preview" className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setUploadedPhoto(null); if (selected) setPromptText(recomputePrompt(selected, genMode, null)) }}
                      className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
                    >
                      ✕ הסר
                    </button>
                    <div className="absolute inset-0 rounded-xl border-2 border-dashed border-white/30 pointer-events-none" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="photo-upload-btn"
                    className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 py-6 text-gray-400 hover:border-green-400 hover:text-green-600"
                  >
                    <span className="text-3xl">📷</span>
                    <span className="text-sm">בחר תמונה להעלאה</span>
                    <span className="text-xs">מומלץ: יחס 1:1 (ריבועי)</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  data-testid="photo-file-input"
                />
              </div>
            )}

            {/* Data checkboxes (bg-text mode only) */}
            {genMode === 'bg-text' && selected && checkboxFields.length > 0 && (
              <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2">
                <p className="mb-1.5 text-[11px] font-medium text-gray-500">נתונים להצגה:</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1" dir="rtl">
                  {checkboxFields.map((field) => (
                    <label key={field.key} className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={overlayConfig[field.key] !== false}
                        onChange={(e) =>
                          setOverlayConfig((prev) => ({ ...prev, [field.key]: e.target.checked }))
                        }
                        className="accent-green-600"
                      />
                      {field.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Edit prompt */}
            {selected && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowEditPrompt((v) => !v)}
                  data-testid="edit-prompt-toggle"
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                  </svg>
                  <span>{showEditPrompt ? 'סגור עריכת פרומפט' : 'ערוך פרומפט'}</span>
                </button>
                {showEditPrompt && (
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    data-testid="edit-prompt-textarea"
                    rows={5}
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
              disabled={!selected || (hasPhoto && !uploadedPhoto)}
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
            {/* Result */}
            <div
              ref={genMode === 'bg-text' ? resultRef : null}
              data-testid="generate-result-image"
              className="relative mb-4 overflow-hidden rounded-xl"
              style={{ aspectRatio: '1 / 1' }}
            >
              <img
                src={imageSrc}
                alt="רקע"
                data-testid="generate-result-img-src"
                className="absolute inset-0 h-full w-full object-cover"
              />
              {genMode === 'bg-text' && (
                <div className="absolute inset-0 text-white" dir="rtl">
                  <OverlayContent type={selected} data={overlayData} config={overlayConfig} />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                data-testid="generate-download"
                className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60 hover:bg-green-700"
              >
                {downloading ? 'מוריד...' : 'הורד'}
              </button>
              {typeof navigator !== 'undefined' && navigator.canShare && (
                <button
                  type="button"
                  onClick={handleShare}
                  data-testid="generate-share"
                  className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700"
                >
                  שתף
                </button>
              )}
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
