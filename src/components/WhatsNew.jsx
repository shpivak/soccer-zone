import { useState } from 'react'

const VERSION = '1.0.5'
const STORAGE_KEY = 'soccer-zone-whats-new-seen'

const WhatsNew = () => {
  const [visible, setVisible] = useState(() => localStorage.getItem(STORAGE_KEY) !== VERSION)

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, VERSION)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl">⚽</span>
          <h2 className="text-lg font-bold">מה חדש בגרסה {VERSION}</h2>
        </div>
        <p className="mb-4 text-xs text-gray-400">Soccer Zone FC</p>
        <ul className="space-y-2.5 text-sm text-gray-700">
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>שמירת נתונים</strong> — כל הנתונים נשמרים אוטומטית ולא יאבדו בין רענונים</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>ניהול מוגן סיסמה</strong> — אזור הניהול מאובטח ונשאר פתוח בתוך הסשן</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>ניווט תחתון</strong> — מצב משחק, סטטיסטיקות וניהול בלחיצה אחת</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>עיצוב חדש</strong> — לוגו, צבעי ירוק ואדום, רקע מרענן ולחצנים ברורים</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>הוספת שחקנים</strong> — כפתור + ישירות בכל קבוצה להוספה מהירה</span>
          </li>
        </ul>
        <button
          onClick={dismiss}
          className="mt-5 w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white"
        >
          הבנתי, יאללה נשחק! ⚽
        </button>
      </div>
    </div>
  )
}

export default WhatsNew
