import { useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useAccesoAuditoria } from '../core/auth/sesionContext'

const SIMA_CHECK_PAGES = new Set(['sima-check-overview', 'training-modules', 'questions', 'bases-conocimiento', 'assignment-rules', 'training-assignments', 'sima-check-estadisticas'])

// "Bases" va pegada a "Preguntas" porque es su taxonomía: se entra ahí para
// definir los temas y escalas con los que después se clasifican las preguntas.
// "Estadísticas" va al final: se lee sobre lo que las demás configuran, y a
// diferencia del Resumen (que responde por la GENTE) responde por el CONTENIDO.
const SIMA_CHECK_TABS = [
  { id: 'sima-check-overview',  label: 'Resumen' },
  { id: 'training-modules',     label: 'Módulos' },
  { id: 'questions',            label: 'Preguntas' },
  { id: 'bases-conocimiento',   label: 'Bases' },
  { id: 'assignment-rules',     label: 'Reglas' },
  { id: 'training-assignments', label: 'Asignaciones' },
  { id: 'sima-check-estadisticas', label: 'Estadísticas' },
]

const NAV_SECTIONS = [
  {
    items: [{ id: 'dashboard', label: 'Panel Principal' }],
  },
  {
    header: 'Administración',
    items: [
      { id: 'usuarios',  label: 'Usuarios' },
      { id: 'organizaciones', label: 'Organizaciones' },
      { id: 'puestos',   label: 'Puestos' },
      { id: 'centros-costo', label: 'Centros de Costo' },
      // Sólo ADMINISTRADOR/AUDITOR la ven (useAccesoAuditoria, abajo) — pero
      // sigue en NAV_SECTIONS sin condición para que el breadcrumb (que sale
      // de ALL_NAV_ITEMS) encuentre su label igual si alguien entra por hash
      // directo. Ocultar el ítem no reemplaza el 403 del backend, sólo evita
      // ofrecer un click que va a fallar.
      { id: 'auditoria', label: 'Auditoría' },
    ],
  },
  {
    header: 'Productos',
    items: [
      { id: 'sima-check-overview', label: 'SIMA CHECK' },
    ],
  },
]

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items)

export default function BackofficeLayout({ page, navigate, children }) {
  const { user, logout } = useAuth0()
  const inSimaCheck = SIMA_CHECK_PAGES.has(page)
  const accesoAuditoria = useAccesoAuditoria()
  // Sólo importa por debajo de `md`: ahí el sidebar deja de ocupar espacio
  // fijo en el flex row y pasa a ser un drawer superpuesto (position fixed),
  // así que necesita un estado explícito de abierto/cerrado. De `md` para
  // arriba el CSS lo fuerza siempre visible y este estado queda sin efecto.
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const irA = (id) => {
    navigate(id)
    setSidebarOpen(false)
  }

  // El rol real (ADMINISTRADOR/COORDINADOR/AUDITOR) no viaja en el perfil de
  // Auth0 a propósito — vive en Vinculacion, no en el token de identidad.
  // Mostrar sólo nombre/email acá es honesto con eso; un endpoint /usuarios/me
  // para el rol queda para otra story.
  const nombre = user?.name ?? user?.email ?? 'Usuario'
  const iniciales = nombre
    .split(/\s+/)
    .map((parte) => parte[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Backdrop del drawer mobile: sólo existe con el sidebar abierto y por
          debajo de `md` (ahí el sidebar ya es parte fija del layout, así que
          taparlo no tendría sentido). */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar. De `md` para arriba es una columna fija más del layout
          (`md:static`); por debajo, un drawer superpuesto (`fixed`) que entra
          y sale con `translate-x`, para no perder ancho de contenido en
          mobile mientras no se pide la navegación. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-56 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 transform transition-transform duration-200 ease-in-out md:static md:translate-x-0 md:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="flex flex-col items-center gap-1">
            <img src="/SIMA LOGO SF.png" alt="SIMA" className="h-8 w-auto object-contain" />
            <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">Training</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_SECTIONS.map((section, i) => (
            <div key={i} className={section.header ? 'mt-5' : 'mt-1'}>
              {section.header && (
                <div className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {section.header}
                </div>
              )}
              <div>
                {section.items
                  .filter((item) => item.id !== 'auditoria' || accesoAuditoria)
                  .map((item) => {
                    const isActive =
                      page === item.id ||
                      (item.id === 'sima-check-overview' && inSimaCheck)
                    return (
                      <button
                        key={item.id}
                        onClick={() => irA(item.id)}
                        className={`w-full flex items-center gap-2.5 py-2 px-4 text-[13px] transition-colors duration-150 text-left border-l-2 ${
                          isActive
                            ? 'border-red-600 text-red-600 bg-red-50 font-medium'
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-normal'
                        }`}
                      >
                        <span
                          className={`w-1 h-1 rounded-full flex-shrink-0 transition-colors ${
                            isActive ? 'bg-red-500' : 'bg-slate-300'
                          }`}
                        />
                        {item.label}
                      </button>
                    )
                  })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-[10px] font-bold text-red-600 font-mono flex-shrink-0">
                {iniciales}
              </div>
              <div className="min-w-0">
                <div className="text-slate-700 text-xs font-medium truncate">{nombre}</div>
                <div className="text-slate-400 text-[10px] tracking-wider truncate">{user?.email}</div>
              </div>
            </div>
            <button
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
              className="text-slate-400 hover:text-red-600 text-[10px] font-medium uppercase tracking-wider flex-shrink-0"
              title="Cerrar sesión"
            >
              Salir
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-11 bg-white border-b border-slate-200 flex items-center justify-between gap-3 px-3 sm:px-6 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden flex-shrink-0 w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Abrir navegación"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4">
                <path strokeLinecap="round" d="M3 5h14M3 10h14M3 15h14" />
              </svg>
            </button>
            <span className="hidden sm:inline text-slate-400 text-[10px] font-mono uppercase tracking-widest flex-shrink-0">
              SIMA TRAINING
            </span>
            <span className="hidden sm:inline text-slate-300 text-xs flex-shrink-0">›</span>
            {inSimaCheck ? (
              <>
                <span className="hidden sm:inline text-slate-500 text-[10px] font-mono uppercase tracking-widest flex-shrink-0">
                  SIMA CHECK
                </span>
                <span className="hidden sm:inline text-slate-300 text-xs flex-shrink-0">›</span>
                <span className="text-slate-700 text-[11px] font-medium uppercase tracking-widest truncate">
                  {SIMA_CHECK_TABS.find((t) => t.id === page)?.label}
                </span>
              </>
            ) : (
              <span className="text-slate-700 text-[11px] font-medium uppercase tracking-widest truncate">
                {ALL_NAV_ITEMS.find((n) => n.id === page)?.label ?? 'Panel Principal'}
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-slate-400 text-[10px] font-mono uppercase tracking-widest">SYS:OPERATIVO</span>
          </div>
        </header>

        {/* SIMA CHECK product tab bar. `overflow-x-auto` y no wrap: es una
            barra de navegación de una sola fila — con siete tabs no entra en
            un viewport angosto, y scrollear horizontalmente ahí adentro (como
            una tabla) es preferible a que la barra empuje overflow a toda la
            página o a que los tabs se aplasten hasta ser ilegibles. */}
        {inSimaCheck && (
          <div className="bg-slate-50 border-b border-slate-200 px-3 sm:px-6 flex items-center gap-1 flex-shrink-0 h-10 overflow-x-auto">
            <div className="flex items-center gap-2 mr-5 border-r border-slate-200 pr-5 flex-shrink-0">
              <div className="w-5 h-5 bg-red-50 border border-red-200 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 font-bold text-[9px] font-mono leading-none">SC</span>
              </div>
              <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap">
                SIMA CHECK
              </span>
            </div>
            {SIMA_CHECK_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => navigate(tab.id)}
                className={`h-full px-3 text-[11px] font-semibold uppercase tracking-widest border-b-2 transition-colors flex-shrink-0 whitespace-nowrap ${
                  page === tab.id
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-4 sm:p-6 bg-slate-200">
          {children}
        </main>
      </div>
    </div>
  )
}
