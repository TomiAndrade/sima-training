const NAV_SECTIONS = [
  {
    items: [
      { id: 'dashboard', label: 'Panel Principal' },
    ],
  },
  {
    header: 'Administración',
    items: [
      { id: 'companies', label: 'Empresas' },
      { id: 'users', label: 'Usuarios' },
    ],
  },
  {
    header: 'SIMA CHECK',
    items: [
      { id: 'sima-check-overview', label: 'Resumen Operacional' },
      { id: 'training-modules', label: 'Capacitaciones' },
      { id: 'questions', label: 'Preguntas' },
      { id: 'training-assignments', label: 'Asignaciones' },
    ],
  },
  {
    header: 'Configuración',
    items: [],
  },
]

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items)

export default function BackofficeLayout({ page, navigate, children }) {
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
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center gap-2.5 py-2 px-4 text-[13px] transition-colors duration-150 text-left border-l-2 ${
                      page === item.id
                        ? 'border-red-600 text-white bg-zinc-900 font-medium'
                        : 'border-transparent text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/60 font-normal'
                    }`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full flex-shrink-0 transition-colors ${
                        page === item.id ? 'bg-red-500' : 'bg-zinc-700'
                      }`}
                    />
                    {item.label}
                  </button>
                ))}
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
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 ml-2" title="Sistema operativo" />
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
            <span className="text-zinc-300 text-[11px] font-medium uppercase tracking-widest">
              {ALL_NAV_ITEMS.find((n) => n.id === page)?.label ?? 'Panel Principal'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">SYS:OPERATIVO</span>
          </div>
        </header>

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
