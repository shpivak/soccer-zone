import { useState } from 'react'

const VERSION = '1.0.7'
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
            <span><strong>הודעות וואטסאפ מוכנות</strong> — תבניות מוכנות לשליחה: תזכורת בוקר, סגלי היום, מערכת משחקים והודעה חופשית</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>מערכת משחקים עם שעות</strong> — הודעה אוטומטית עם שעות התחלה, אמוג׳י שעון וצבעי הקבוצות</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>בחירת טורניר להודעה</strong> — בחר לאיזה יום/סבב לשלוח ישירות מאזור הניהול</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>עריכת תוצאות</strong> — עריכת תוצאות ואירועי משחק קיימים ישירות מהטבלה</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>שיתוף וקישור ישיר</strong> — קישור לליגה וטורניר ספציפיים, שיתוף סגלים בוואטסאפ</span>
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
