import { useEffect, useRef, useState } from 'react'

const inputCls = 'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

// Dropdown reusable: botón trigger + panel con búsqueda, "seleccionar todos"
// (de los filtrados) y lista de checkboxes. Cierra al click afuera.
export default function MultiSelectFilter({ options, selectedIds, onChange, placeholder = 'Filtrar...' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id))

  const toggleOne = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const toggleAllFiltered = () => {
    const next = new Set(selectedIds)
    if (allFilteredSelected) filtered.forEach((o) => next.delete(o.id))
    else filtered.forEach((o) => next.add(o.id))
    onChange(next)
  }

  const label =
    selectedIds.size === 0
      ? placeholder
      : selectedIds.size === 1
        ? (options.find((o) => selectedIds.has(o.id))?.label ?? `${selectedIds.size} seleccionado`)
        : `${selectedIds.size} módulos seleccionados`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`${inputCls} text-left flex items-center justify-between gap-2 min-w-[220px]`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{label}</span>
        <span className="text-slate-400 text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-72 bg-white border border-slate-200 rounded shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              className={inputCls}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar módulo..."
            />
          </div>
          <label className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 cursor-pointer hover:bg-slate-50 text-sm text-slate-600">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} />
            Seleccionar todos {q && '(filtrados)'}
          </label>
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-slate-400 text-xs font-mono">— Sin resultados —</div>
            )}
            {filtered.map((o) => (
              <label key={o.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm">
                <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleOne(o.id)} />
                <span className="text-slate-700 truncate">{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
