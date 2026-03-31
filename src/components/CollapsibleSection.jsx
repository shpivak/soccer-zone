import { useState } from 'react'

const CollapsibleSection = ({ title, defaultOpen = true, headerExtra, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="flex min-h-[48px] items-center justify-between gap-2 px-4">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex flex-1 items-center gap-2 py-3 text-left font-semibold"
        >
          <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
          <span>{title}</span>
        </button>
        {headerExtra ? <div className="flex shrink-0 items-center">{headerExtra}</div> : null}
      </div>
      {isOpen ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  )
}

export default CollapsibleSection
