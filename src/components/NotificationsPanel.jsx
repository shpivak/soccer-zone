import { useEffect, useState } from 'react'
import { shareViaWhatsApp } from '../utils/shareUtils'
import { getTeamDisplayName } from '../utils/leagueUtils'

const WEEKLY_REMINDER_KEY = 'soccer-zone-weekly-reminder'

const colorEmoji = {
  black: '⚫', yellow: '🟡', pink: '🟣', orange: '🟠',
  blue: '🔵', gray: '⚪', white: '⚪',
}

const getClockEmoji = (hour, min) => {
  const h = hour % 12 || 12
  return min >= 30
    ? String.fromCodePoint(0x1F55B + h) // 🕜 – 🕧
    : String.fromCodePoint(0x1F54F + h) // 🕐 – 🕛
}

const addMinutes = (baseTime, offsetMinutes) => {
  const [h, m] = baseTime.split(':').map(Number)
  const total = h * 60 + m + offsetMinutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const generateFixturesMessage = (teams, leagueName, startTime = '18:00') => {
  const slots = []
  for (let i = 0; i + 1 < teams.length; i += 2) {
    const timeStr = addMinutes(startTime, Math.floor(i / 2) * 90)
    const [hh, mm] = timeStr.split(':').map(Number)
    const t1 = teams[i]
    const t2 = teams[i + 1]
    slots.push(
      `${getClockEmoji(hh, mm)} ${timeStr} – ${colorEmoji[t1.color] ?? '⚽'} ${getTeamDisplayName(t1)} & ${colorEmoji[t2.color] ?? '⚽'} ${getTeamDisplayName(t2)}`,
    )
  }
  return `📋 *${leagueName}*\n${slots.join('\n') || '[אין מספיק קבוצות]'}`
}

const getTemplates = (leagueName, teamsMsg, teams) => [
  {
    id: 'morning',
    emoji: '🌅',
    label: 'תזכורת בוקר',
    defaultTime: '10:00',
    message: `היי חברים! 🌅\nתזכורת - מחר יש ${leagueName}! ⚽\nלא לשכוח להגיע 💪`,
  },
  {
    id: 'update',
    emoji: '🔄',
    label: 'עדכון חשוב',
    defaultTime: null,
    message: `עדכון ל${leagueName} 🔄\n\n`,
  },
  {
    id: 'squads',
    emoji: '👥',
    label: 'סגלי היום',
    defaultTime: '18:00',
    message: teamsMsg || `👥 סגלי היום ל${leagueName}:\n[עבור לטאב "מצב משחק" כדי לשלוח סגלים]`,
  },
  ...(teams.length >= 2
    ? [
        {
          id: 'fixtures',
          emoji: '📋',
          label: 'מערכת משחקים',
          defaultTime: '18:00',
          message: generateFixturesMessage(teams, leagueName),
        },
      ]
    : []),
  {
    id: 'custom',
    emoji: '💬',
    label: 'הודעה חופשית',
    defaultTime: null,
    message: '',
  },
]

// Recursive weekly scheduler — returns a cancel function
const scheduleWeekly = (time, message) => {
  let cancelled = false
  let timer
  const schedule = () => {
    const [h, m] = time.split(':').map(Number)
    const now = new Date()
    const target = new Date()
    target.setHours(h, m, 0, 0)
    if (target <= now) target.setDate(target.getDate() + 7)
    timer = setTimeout(() => {
      if (cancelled) return
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Soccer Zone FC ⚽', { body: message.slice(0, 250), icon: '/soccer-zone-logo.jpeg' })
      }
      schedule()
    }, target.getTime() - now.getTime())
  }
  schedule()
  return () => {
    cancelled = true
    clearTimeout(timer)
  }
}

const WhatsAppIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const TIME_PRESETS = [
  { label: '🌅 10:00', value: '10:00' },
  { label: '🌆 18:00', value: '18:00' },
  { label: '✏️ אחר', value: 'custom' },
]

const NotificationsPanel = ({ leagueName = '', teamsMsg = '', teams = [] }) => {
  const today = new Date().toISOString().slice(0, 10)
  const notificationSupported = typeof window !== 'undefined' && 'Notification' in window

  const [activeTemplateId, setActiveTemplateId] = useState(null)
  const [messageText, setMessageText] = useState('')
  const [showScheduler, setShowScheduler] = useState(false)
  const [reminderDate, setReminderDate] = useState(today)
  const [reminderTimePreset, setReminderTimePreset] = useState(null)
  const [reminderTimeCustom, setReminderTimeCustom] = useState('')
  const [isWeekly, setIsWeekly] = useState(false)
  const [scheduledLabel, setScheduledLabel] = useState('')
  const [hasWeeklyReminder, setHasWeeklyReminder] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem(WEEKLY_REMINDER_KEY),
  )

  const reminderTime = reminderTimePreset === 'custom' ? reminderTimeCustom : (reminderTimePreset ?? '')
  const notificationPermission = notificationSupported ? Notification.permission : 'denied'

  // Restore weekly reminder from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(WEEKLY_REMINDER_KEY)
    if (!stored || !notificationSupported) return
    try {
      const { time, message } = JSON.parse(stored)
      if (Notification.permission === 'granted') {
        const cancel = scheduleWeekly(time, message)
        return cancel
      }
    } catch {
      localStorage.removeItem(WEEKLY_REMINDER_KEY)
      setHasWeeklyReminder(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const templates = getTemplates(leagueName, teamsMsg, teams)

  const handleSelectTemplate = (template) => {
    if (activeTemplateId === template.id) {
      setActiveTemplateId(null)
      setMessageText('')
      setShowScheduler(false)
      return
    }
    setActiveTemplateId(template.id)
    setMessageText(template.message)
    setShowScheduler(false)
    setScheduledLabel('')
    setReminderTimePreset(template.defaultTime ?? null)
  }

  const handleSchedule = async () => {
    if (!reminderTime) return
    if (!notificationSupported) { alert('הדפדפן שלך לא תומך בהתראות'); return }
    let permission = Notification.permission
    if (permission === 'default') permission = await Notification.requestPermission()
    if (permission !== 'granted') { alert('הרשאת התראות נדחתה. ניתן לשנות זאת בהגדרות הדפדפן.'); return }

    const [h, m] = reminderTime.split(':').map(Number)
    const target = new Date(reminderDate)
    target.setHours(h, m, 0, 0)
    // Auto-advance past times instead of erroring
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + (isWeekly ? 7 : 1))
    }

    const captured = messageText
    if (isWeekly) {
      localStorage.setItem(WEEKLY_REMINDER_KEY, JSON.stringify({ time: reminderTime, message: captured }))
      setHasWeeklyReminder(true)
      scheduleWeekly(reminderTime, captured)
      setScheduledLabel(`✓ תזכורת שבועית נקבעה ל-${reminderTime}`)
    } else {
      const delay = target.getTime() - Date.now()
      setTimeout(() => {
        new Notification('Soccer Zone FC ⚽', { body: captured.slice(0, 250), icon: '/soccer-zone-logo.jpeg' })
      }, delay)
      const label = target.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      setScheduledLabel(`✓ תזכורת נקבעה ל-${label}`)
    }
    setShowScheduler(false)
  }

  const handleCancelWeekly = () => {
    localStorage.removeItem(WEEKLY_REMINDER_KEY)
    setHasWeeklyReminder(false)
    setScheduledLabel('')
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">📣 הודעות ותזכורות</h3>
        <div className="flex items-center gap-2">
          {hasWeeklyReminder ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-blue-600">🔁 תזכורת שבועית פעילה</span>
              <button
                type="button"
                onClick={handleCancelWeekly}
                data-testid="notif-cancel-weekly"
                className="text-xs text-gray-400 underline hover:text-gray-600"
              >
                בטל
              </button>
            </div>
          ) : null}
          {notificationSupported && notificationPermission === 'default' ? (
            <button
              type="button"
              onClick={() => Notification.requestPermission()}
              className="rounded-lg border px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
            >
              🔔 אפשר התראות
            </button>
          ) : null}
          {notificationSupported && notificationPermission === 'granted' && !hasWeeklyReminder ? (
            <span className="text-xs text-green-600">🔔 התראות מופעלות</span>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">בחר תבנית, ערוך את ההודעה ושלח.</p>

      {/* Template buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => handleSelectTemplate(template)}
            data-testid={`notif-template-${template.id}`}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
              activeTemplateId === template.id
                ? 'border-green-400 bg-green-50 text-green-800'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>{template.emoji}</span>
            <span>{template.label}</span>
          </button>
        ))}
      </div>

      {/* Message editor */}
      {activeTemplateId ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            data-testid="notif-message-textarea"
            rows={5}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="כתוב את ההודעה כאן..."
            dir="rtl"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => shareViaWhatsApp(messageText)}
              disabled={!messageText.trim()}
              data-testid="notif-send-whatsapp"
              className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm text-white disabled:opacity-40 hover:bg-[#1ebe5c]"
            >
              <WhatsAppIcon />
              שלח בוואטסאפ
            </button>
            {notificationSupported ? (
              <button
                type="button"
                onClick={() => {
                  setShowScheduler((p) => !p)
                  setScheduledLabel('')
                }}
                disabled={!messageText.trim()}
                data-testid="notif-schedule-toggle"
                className="flex items-center gap-1.5 rounded-xl border bg-white px-4 py-2 text-sm text-gray-700 disabled:opacity-40 hover:bg-gray-50"
              >
                ⏰ תזכיר לי
              </button>
            ) : null}
            {scheduledLabel ? <span className="text-xs text-green-700">{scheduledLabel}</span> : null}
          </div>

          {/* Scheduler */}
          {showScheduler ? (
            <div className="space-y-3 rounded-xl border bg-gray-50 p-3" data-testid="notif-scheduler">
              {/* Date */}
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-gray-600">📅</span>
                <input
                  type="date"
                  value={reminderDate}
                  min={today}
                  onChange={(e) => setReminderDate(e.target.value)}
                  data-testid="notif-reminder-date"
                  className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
                />
              </div>

              {/* Time presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600">🕐</span>
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setReminderTimePreset(preset.value)}
                    data-testid={`notif-time-preset-${preset.value}`}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      reminderTimePreset === preset.value
                        ? 'border-green-400 bg-green-50 text-green-800'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                {reminderTimePreset === 'custom' ? (
                  <input
                    type="time"
                    value={reminderTimeCustom}
                    onChange={(e) => setReminderTimeCustom(e.target.value)}
                    data-testid="notif-time-custom"
                    className="rounded-lg border px-3 py-1.5 text-sm"
                    autoFocus
                  />
                ) : null}
              </div>

              {/* Weekly toggle */}
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isWeekly}
                  onChange={(e) => setIsWeekly(e.target.checked)}
                  data-testid="notif-weekly-checkbox"
                  className="h-4 w-4 rounded"
                />
                🔁 חזור כל שבוע
              </label>

              <button
                type="button"
                onClick={handleSchedule}
                disabled={!reminderTime}
                data-testid="notif-schedule-confirm"
                className="min-h-[40px] w-full rounded-xl bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-40 hover:bg-green-700"
              >
                קבע תזכורת
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default NotificationsPanel
