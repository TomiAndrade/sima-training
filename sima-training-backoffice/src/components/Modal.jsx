import { useEffect } from 'react'

const SIZES = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-3xl' }

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative z-10 bg-white border border-slate-200 rounded shadow-xl w-full ${SIZES[size] ?? SIZES.md} flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-slate-900 font-semibold text-xs uppercase tracking-widest">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors text-sm leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
