import { useState } from 'react'
import packageJson from '../../package.json'

const VERSION = packageJson.version
const STORAGE_KEY = 'soccer-zone-whats-new-seen'

const WhatsNew = ({ adminMode }) => {
  const [visible, setVisible] = useState(() => localStorage.getItem(STORAGE_KEY) !== VERSION)

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, VERSION)
    setVisible(false)
  }

  if (!adminMode || !visible) return null

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
            <span><strong>ניקוד חי שורד רענון</strong> — תוצאה בהכנה נשמרת אוטומטית, לא תיעלם אם תרענן בטעות</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>ידידות עם 2 קבוצות</strong> — יום ידידות נפתח עם 2 קבוצות, עם אפשרות להוסיף ולהסיר קבוצות וגג 11 שחקנים לקבוצה</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>תאריך יום ניתן לעריכה</strong> — שינוי תאריך הטורניר ישירות מממשק הניהול</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>שיתוף ללא קישורים</strong> — הודעות השיתוף נקיות ללא כתובות URL</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>ליגה אחרונה נזכרת</strong> — הליגה שבחרת נשמרת ומחכה לך בפתיחה הבאה</span>
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
