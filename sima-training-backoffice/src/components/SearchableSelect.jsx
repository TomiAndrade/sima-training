import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const inputCls =
  'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

// Igual que inputCls pero SIN clase de ancho: el ancho lo decide el consumidor
// por `className` (default 'w-full'). Si la base trajera `w-full`, pasarle
// `w-auto` no lo pisaría — entre dos utilidades de Tailwind del mismo grupo
// gana la que aparece después en el CSS generado, no en el string.
const triggerCls =
  'bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

const PANEL_ALTO = 280 // alto máximo estimado del panel, para decidir si abre hacia arriba

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
// eso deja la mitad del componente detrás de condicionales.
//
// **El panel va en un portal a `document.body`, con `position: fixed`.** No es
// decoración: la mitad de los consumidores están dentro de un `Modal`, cuyo
// cuerpo es `overflow-y-auto` — un panel `absolute` ahí adentro queda recortado
// por ese contenedor y las opciones de abajo se vuelven inalcanzables sin
// scrollear el modal. Con `fixed` fuera del árbol del modal, el panel flota
// sobre todo. El costo es que hay que cerrarlo si algo scrollea (si no, queda
// pegado en la pantalla mientras el disparador se va), y de eso se ocupa el
// listener de scroll en fase de captura, que también ve el scroll del modal.
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
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [coords, setCoords] = useState(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  const seleccionada = options.find((o) => o.id === value)
  const label = seleccionada?.label ?? (value ? value : placeholder)

  const posicionar = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Si abajo no entra pero arriba sí, abre hacia arriba. Con poco lugar en
    // los dos lados se queda abajo y el panel scrollea por dentro.
    const abajo = window.innerHeight - r.bottom
    const haciaArriba = abajo < PANEL_ALTO && r.top > abajo
    setCoords({
      left: r.left,
      width: r.width,
      ...(haciaArriba
        ? { bottom: window.innerHeight - r.top + 4 }
        : { top: r.bottom + 4 }),
    })
  }

  useLayoutEffect(() => {
    if (open) posicionar()
  }, [open])

  useEffect(() => {
    if (!open) return

    const onClickOutside = (e) => {
      // El panel vive en un portal, así que no está dentro de triggerRef:
      // hay que chequear los dos nodos o se cerraría al tocar sus opciones.
      if (triggerRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onScrollOrResize = () => setOpen(false)
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }

    document.addEventListener('mousedown', onClickOutside)
    // Captura: los eventos de scroll no burbujean, y el que importa acá es el
    // del cuerpo del modal, no el de window.
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

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
            className="z-[60] bg-white border border-slate-200 rounded shadow-lg"
          >
            <div className="p-2 border-b border-slate-100">
              <input
                autoFocus
                className={inputCls}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
              />
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
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
