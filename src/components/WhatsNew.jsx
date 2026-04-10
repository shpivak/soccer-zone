import { useState } from 'react'

const VERSION = '1.0.9'
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
            <span><strong>תיקוני DB ויציבות</strong> — פחות תקלות בטעינה ושמירת נתונים, הכל עובד ישירות מול השרת</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>מחיקת ליגה</strong> — מחיקה מלאה של ליגה כולל כל השחקנים, הטורנירים והתוצאות שלה</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>סטטיסטיקות מלאות</strong> — כל שחקן עם שער או בישול מוצג בטבלה, לא רק 5 הראשונים</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 text-green-600">✓</span>
            <span><strong>תיקוני באגים נוספים</strong> — שיפורי ביצועים ויציבות כלליים</span>
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
