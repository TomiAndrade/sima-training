import { useState } from 'react'
import { createPortal } from 'react-dom'
import usePanelFlotante from './usePanelFlotante'

const inputCls = 'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

// El panel nunca es más angosto que el viejo `w-72`, aunque el trigger lo sea:
// los nombres de módulo y de puesto son largos y truncarlos más no ayuda.
const ANCHO_MINIMO = 288

// Dropdown reusable: botón trigger + panel con búsqueda, "seleccionar todos"
// (de los filtrados) y lista de checkboxes. Cierra al click afuera.
//
// El panel va en un PORTAL a document.body con position: fixed — ver
// `usePanelFlotante`, que es donde vive el porqué (spoiler: adentro de un
// `Modal` un panel `absolute` le genera scroll al cuerpo del modal, y clickear
// esa barra cerraba el desplegable).
export default function MultiSelectFilter({ options, selectedIds, onChange, placeholder = 'Filtrar...', searchPlaceholder = 'Buscar módulo...' }) {
  const [q, setQ] = useState('')
  const { open, setOpen, coords, triggerRef, panelRef } = usePanelFlotante()

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
        : `${selectedIds.size} seleccionados`

  return (
    <>
      {/* El wrapper ya no posiciona nada (el panel se fue al portal), pero se
          queda: el trigger es `w-full`, y suelto en la barra de filtros —que es
          un flex— ese 100% pasa a medirse contra la fila entera en vez de contra
          su caja. */}
      <div>
        <button
          type="button"
          ref={triggerRef}
          className={`${inputCls} text-left flex items-center justify-between gap-2 min-w-[220px]`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="truncate">{label}</span>
          <span className="text-slate-400 text-xs">▾</span>
        </button>
      </div>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', ...coords, minWidth: ANCHO_MINIMO }}
            className="z-[60] bg-white border border-slate-200 rounded shadow-lg flex flex-col"
          >
            {/* El buscador y "seleccionar todos" no se achican: el `maxHeight`
                del panel lo absorbe la lista scrolleando por dentro. */}
            <div className="p-2 border-b border-slate-100 flex-shrink-0">
              <input
                autoFocus
                className={inputCls}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
              />
            </div>
            <label className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 cursor-pointer hover:bg-slate-50 text-sm text-slate-600 flex-shrink-0">
              <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} />
              Seleccionar todos {q && '(filtrados)'}
            </label>
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
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
          </div>,
          document.body
        )}
    </>
  )
}
