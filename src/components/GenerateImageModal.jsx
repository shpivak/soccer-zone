import { useState } from 'react'
import { buildPrompt } from '../gen-ai/buildPrompt'
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
  if (mode === 'squads') return [] // no picker — squads is the only type
  return STATS_OPTIONS
}

const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
  </svg>
)

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
  const [promptText, setPromptText] = useState(() =>
    isSquadsMode ? buildPrompt('squads', { league, session, players }) : '',
  )
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imageSrc, setImageSrc] = useState(null)
  const [error, setError] = useState(null)

  const handleSelectOption = (id) => {
    setSelected(id)
    setPromptText(buildPrompt(id, { stats, leaders, standings, league, session, players }))
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

  const handleDownload = () => {
    if (!imageSrc) return
    const a = document.createElement('a')
    a.href = imageSrc
    a.download = `soccer-zone-${selected}.png`
    a.click()
  }

  const handleBack = () => {
    setImageSrc(null)
    setError(null)
  }

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
            {/* Option picker — not shown in squads mode */}
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

            {/* Edit prompt drawer — shown when an option is selected */}
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
                    dir="rtl"
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
            <div className="mb-4 overflow-hidden rounded-xl border border-gray-200">
              <img src={imageSrc} alt="תמונה שנוצרה" data-testid="generate-result-image" className="w-full" />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownload}
                data-testid="generate-download"
                className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 font-semibold text-white hover:bg-green-700"
              >
                הורד תמונה
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
