import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="relative z-10 bg-zinc-900 border border-zinc-700 rounded shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-white font-semibold text-xs uppercase tracking-widest">{title}</h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors text-sm leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
