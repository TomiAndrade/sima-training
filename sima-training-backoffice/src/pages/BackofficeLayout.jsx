const SIMA_CHECK_PAGES = new Set(['sima-check-overview', 'training-modules', 'questions', 'training-assignments'])

const SIMA_CHECK_TABS = [
  { id: 'sima-check-overview',  label: 'Resumen' },
  { id: 'training-modules',     label: 'Capacitaciones' },
  { id: 'questions',            label: 'Preguntas' },
  { id: 'training-assignments', label: 'Asignaciones' },
]

const NAV_SECTIONS = [
  {
    items: [{ id: 'dashboard', label: 'Panel Principal' }],
  },
  {
    header: 'Administración',
    items: [
      { id: 'companies', label: 'Empresas' },
      { id: 'users',     label: 'Usuarios' },
    ],
  },
  {
    header: 'Productos',
    items: [
      { id: 'sima-check-overview', label: 'SIMA CHECK' },
    ],
  },
  {
    header: 'Configuración',
    items: [],
  },
]

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items)

export default function BackofficeLayout({ page, navigate, children }) {
  const inSimaCheck = SIMA_CHECK_PAGES.has(page)

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center font-bold text-white text-[11px] tracking-widest">
              ST
            </div>
            <div>
              <div className="font-semibold text-white text-sm tracking-wide leading-tight">SIMA TRAINING</div>
              <div className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">Plataforma v2.0</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_SECTIONS.map((section, i) => (
            <div key={i} className={section.header ? 'mt-5' : 'mt-1'}>
              {section.header && (
                <div className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                  {section.header}
                </div>
              )}
              <div>
                {section.items.map((item) => {
                  const isActive =
                    page === item.id ||
                    (item.id === 'sima-check-overview' && inSimaCheck)
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={`w-full flex items-center gap-2.5 py-2 px-4 text-[13px] transition-colors duration-150 text-left border-l-2 ${
                        isActive
                          ? 'border-red-600 text-white bg-zinc-900 font-medium'
                          : 'border-transparent text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/60 font-normal'
                      }`}
                    >
                      <span
                        className={`w-1 h-1 rounded-full flex-shrink-0 transition-colors ${
                          isActive ? 'bg-red-500' : 'bg-zinc-700'
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
        <div className="px-4 py-3 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center text-[10px] font-bold text-red-400 font-mono flex-shrink-0">
                CM
              </div>
              <div className="min-w-0">
                <div className="text-zinc-300 text-xs font-medium truncate">Carlos Méndez</div>
                <div className="text-zinc-600 text-[10px] uppercase tracking-wider">Administrador</div>
              </div>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 ml-2" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-11 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">SIMA TRAINING</span>
            <span className="text-zinc-700 text-xs">›</span>
            {inSimaCheck ? (
              <>
                <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">SIMA CHECK</span>
                <span className="text-zinc-700 text-xs">›</span>
                <span className="text-zinc-300 text-[11px] font-medium uppercase tracking-widest">
                  {SIMA_CHECK_TABS.find((t) => t.id === page)?.label}
                </span>
              </>
            ) : (
              <span className="text-zinc-300 text-[11px] font-medium uppercase tracking-widest">
                {ALL_NAV_ITEMS.find((n) => n.id === page)?.label ?? 'Panel Principal'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">SYS:OPERATIVO</span>
          </div>
        </header>

        {/* SIMA CHECK product tab bar */}
        {inSimaCheck && (
          <div className="bg-zinc-900 border-b border-zinc-800 px-6 flex items-center gap-1 flex-shrink-0 h-10">
            <div className="flex items-center gap-2 mr-5 border-r border-zinc-800 pr-5">
              <div className="w-5 h-5 bg-red-600/20 border border-red-900/50 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-red-500 font-bold text-[9px] font-mono leading-none">SC</span>
              </div>
              <span className="text-zinc-500 text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap">
                SIMA CHECK
              </span>
            </div>
            {SIMA_CHECK_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => navigate(tab.id)}
                className={`h-full px-3 text-[11px] font-semibold uppercase tracking-widest border-b-2 transition-colors ${
                  page === tab.id
                    ? 'border-red-600 text-white'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <main
          className="flex-1 overflow-y-auto p-6 bg-zinc-950"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
