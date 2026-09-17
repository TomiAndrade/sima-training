import { useState } from 'react'
import { createPortal } from 'react-dom'
import usePanelFlotante from './usePanelFlotante'

const inputCls =
  'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

// Igual que inputCls pero SIN clase de ancho: el ancho lo decide el consumidor
// por `className` (default 'w-full'). Si la base trajera `w-full`, pasarle
// `w-auto` no lo pisaría — entre dos utilidades de Tailwind del mismo grupo
// gana la que aparece después en el CSS generado, no en el string.
const triggerCls =
  'bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

// Sin acentos y en minúsculas: el catálogo real mezcla códigos (S31, OB308) con
// nombres, y nadie tipea el acento al buscar.
const normalizar = (s) =>
  (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

// Desplegable de selección ÚNICA con buscador. Hermano de MultiSelectFilter:
// mismo lenguaje visual (trigger + panel + input de búsqueda arriba), contrato
// distinto — un valor escalar en vez de un Set, cierra al elegir, y ofrece una
// opción vacía ("Todos los puestos") que en el multi no tiene sentido.
//
// Existe como componente aparte y no como un prop `single` de MultiSelectFilter
// porque casi todo lo que los diferencia son comportamientos OPUESTOS
// (seleccionar todos vs opción vacía, quedarse abierto vs cerrar al elegir), y
// eso deja la mitad del componente detrás de condicionales. Lo que sí comparten
// es cómo se abre, se ubica y se cierra el panel: eso vive en
// `usePanelFlotante` (portal a document.body + position fixed, con el porqué).
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Elegir…',
  // Texto de la opción que limpia la selección (value = ''). Si no viene, no
  // se ofrece — en un formulario obligatorio no hay "ninguno".
  emptyLabel,
  searchPlaceholder = 'Buscar…',
  disabled = false,
  className = 'w-full',
}) {
  const [q, setQ] = useState('')
  const { open, setOpen, coords, triggerRef, panelRef } = usePanelFlotante()

  const seleccionada = options.find((o) => o.id === value)
  const label = seleccionada?.label ?? (value ? value : placeholder)

  const abrir = () => {
    if (disabled) return
    setQ('')
    setOpen((o) => !o)
  }

  const elegir = (id) => {
    onChange(id)
    setOpen(false)
  }

  const nq = normalizar(q)
  const filtradas = nq
    ? options.filter((o) => normalizar(o.label).includes(nq))
    : options

  const filaCls = (activa) =>
    `w-full text-left px-3 py-2 text-sm truncate transition-colors ${
      activa ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-700 hover:bg-slate-50'
    }`

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={abrir}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${triggerCls} text-left flex items-center justify-between gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      >
        <span className={`truncate ${seleccionada || value ? '' : 'text-slate-400'}`}>{label}</span>
        <span className="text-slate-400 text-xs flex-shrink-0">▾</span>
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{ position: 'fixed', ...coords }}
            className="z-[60] bg-white border border-slate-200 rounded shadow-lg flex flex-col"
          >
            {/* El buscador no se achica: el `maxHeight` del panel lo absorbe
                la lista scrolleando por dentro. */}
            <div className="p-2 border-b border-slate-100 flex-shrink-0">
              <input
                autoFocus
                className={inputCls}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
              {/* La opción vacía no se filtra con la búsqueda: es la salida
                  para limpiar el filtro y tiene que estar siempre a mano. */}
              {emptyLabel !== undefined && (
                <button type="button" className={filaCls(!value)} onClick={() => elegir('')}>
                  {emptyLabel}
                </button>
              )}
              {filtradas.length === 0 && (
                <div className="px-3 py-4 text-center text-slate-400 text-xs font-mono">
                  — Sin resultados —
                </div>
              )}
              {filtradas.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  className={filaCls(o.id === value)}
                  onClick={() => elegir(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
