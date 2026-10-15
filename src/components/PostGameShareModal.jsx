import { useEffect, useRef, useState } from 'react'
import { cropToPortrait, sharePhotoToWhatsApp } from '../utils/shareUtils'
import { setPostGameShareEnabled } from '../utils/postGameShare'

const STATUS_TEXT = {
  shared: '✓ נשלח! אם הטקסט לא הופיע בוואטסאפ — הוא הועתק, פשוט הדביקו',
  fallback: '✓ התמונה הורדה והטקסט הועתק — הדביקו בקבוצת המאמנים',
}

const PostGameShareModal = ({ message, onClose }) => {
  const inputRef = useRef(null)
  const [photo, setPhoto] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setStatus('')
    setProcessing(true)
    try {
      const portrait = await cropToPortrait(file)
      setPhoto(portrait)
      setPreviewUrl(URL.createObjectURL(portrait))
    } catch {
      setError('לא הצלחנו לטעון את התמונה, נסו שוב')
    } finally {
      setProcessing(false)
    }
  }

  const handleSend = async () => {
    const result = await sharePhotoToWhatsApp(photo, message)
    if (result !== 'cancelled') setStatus(result)
  }

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

        <pre
          data-testid="post-game-share-text"
          className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-right font-sans text-sm text-gray-700"
        >
          {message}
        </pre>

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
          {photo ? 'שלח תמונה + תוצאה לקבוצת המאמנים' : 'שלח תוצאה לקבוצת המאמנים'}
        </button>

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
