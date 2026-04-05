import { useState } from 'react'

const VERSION = '1.0.6'
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
            <span><strong>לוח תוצאות משופר</strong> — פריסה זה לצד זה, צבע קבוצה ברקע, שעון אופציונלי עם מילישניות</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>דירוג עם מדליות</strong> — 🥇🥈🥉 למקומות 1–5 בכובשים, מבשלים והגנה</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>תיאור משחק</strong> — שדה טקסט אופציונלי לתיאור כל משחק, מוצג בטבלה ובשיתוף</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>שיתוף בוואטסאפ</strong> — הודעת סיכום יומית וכללית עם כפתורי שיתוף והעתקה</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>מחיקת יום</strong> — כפתור למחיקת הטורניר הנבחר ישירות מהמסך</span>
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
