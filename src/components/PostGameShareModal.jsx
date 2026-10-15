import { useEffect, useMemo, useRef, useState } from 'react'
import { copyImageToClipboard, copyTextToClipboard, cropToPortrait, sharePhotoToWhatsApp } from '../utils/shareUtils'
import { setPostGameShareEnabled } from '../utils/postGameShare'

const STATUS_TEXT = {
  shared: '✓ נשלח! אם הטקסט לא הופיע בוואטסאפ — הוא הועתק, פשוט הדביקו',
  'image-copied': '✓ התמונה והטקסט הועתקו — פתחו את קבוצת המאמנים והדביקו',
  'photo-downloaded': '✓ התמונה הורדה והטקסט הועתק — צרפו את התמונה והדביקו בקבוצת המאמנים',
  'text-only': '✓ הטקסט הועתק — הדביקו בקבוצת המאמנים',
  'copied-text': '✓ הטקסט הועתק',
  'copied-image': '✓ התמונה הועתקה — הדביקו בוואטסאפ',
  'copy-failed': 'הדפדפן לא מאפשר העתקה כאן — נסו את כפתור השליחה',
}

/**
 * Shown after a new game is saved: editable result text, portrait photo, and one button that sends both to WhatsApp.
 * `photo` lives in the parent so it survives going back to edit the game result.
 */
const PostGameShareModal = ({ message, photo, onPhotoChange, onEditGame, onClose }) => {
  const inputRef = useRef(null)
  const [text, setText] = useState(message)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const previewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : ''), [photo])
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setStatus('')
    setProcessing(true)
    try {
      onPhotoChange(await cropToPortrait(file))
    } catch {
      setError('לא הצלחנו לטעון את התמונה, נסו שוב')
    } finally {
      setProcessing(false)
    }
  }

  const handleSend = async () => {
    const result = await sharePhotoToWhatsApp(photo, text)
    if (result !== 'cancelled') setStatus(result)
  }

  const handleCopyText = async () => setStatus((await copyTextToClipboard(text)) ? 'copied-text' : 'copy-failed')
  const handleCopyImage = async () => setStatus((await copyImageToClipboard(photo)) ? 'copied-image' : 'copy-failed')

  const handleClose = () => {
    if (dontShowAgain) setPostGameShareEnabled(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
      data-testid="post-game-share-modal"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">📸 המשחק נשמר!</h2>
          <button type="button" onClick={handleClose} className="text-xl text-gray-400" aria-label="סגור">
            ✕
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.min(14, text.split('\n').length + 1)}
          data-testid="post-game-share-text"
          className="w-full resize-y rounded-xl border bg-gray-50 p-3 text-right text-sm text-gray-700"
        />
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setText(message)}
            disabled={text === message}
            data-testid="post-game-reset-text"
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-700 disabled:opacity-40"
          >
            ↺ אפס טקסט
          </button>
          <button
            type="button"
            onClick={onEditGame}
            data-testid="post-game-edit-game"
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-gray-700"
          >
            ✏️ חזור לעריכת התוצאה
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
          data-testid="post-game-photo-input"
        />

        {previewUrl ? (
          <img
            src={previewUrl}
            alt="תמונת המשחק"
            data-testid="post-game-photo-preview"
            className="mx-auto aspect-[3/4] w-2/3 rounded-xl object-cover"
          />
        ) : null}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          data-testid="post-game-take-photo"
          className="rounded-xl bg-gray-800 px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          {processing ? 'מעבד…' : photo ? '📸 צלם שוב' : '📸 צלם תמונה (לאורך)'}
        </button>

        <button
          type="button"
          onClick={handleSend}
          data-testid="post-game-send-whatsapp"
          className="rounded-xl bg-[#25D366] px-4 py-3 font-medium text-white hover:bg-[#1ebe5c]"
        >
          {photo ? 'שלח תמונה + תוצאה לוואטסאפ' : 'שלח תוצאה לוואטסאפ'}
        </button>

        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={handleCopyText}
            data-testid="post-game-copy-text"
            className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-gray-700"
          >
            📋 העתק טקסט
          </button>
          {photo ? (
            <button
              type="button"
              onClick={handleCopyImage}
              data-testid="post-game-copy-image"
              className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-gray-700"
            >
              🖼️ העתק תמונה
            </button>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {status ? (
          <p data-testid="post-game-share-status" className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
            {STATUS_TEXT[status]}
          </p>
        ) : null}

        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            data-testid="post-game-dont-show"
          />
          אל תציג חלון זה אחרי משחקים (במכשיר הזה)
        </label>
      </div>
    </div>
  )
}

export default PostGameShareModal
