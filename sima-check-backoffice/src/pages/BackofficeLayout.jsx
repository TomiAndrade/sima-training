const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'companies', label: 'Empresas', icon: '🏢' },
  { id: 'users', label: 'Usuarios', icon: '👤' },
  { id: 'modules', label: 'Módulos', icon: '📋' },
  { id: 'questions', label: 'Preguntas', icon: '❓' },
]

export default function BackofficeLayout({ page, navigate, children }) {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 border-r border-slate-700 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center font-black text-slate-950 text-sm">S</div>
            <div>
              <div className="font-bold text-white text-sm leading-tight">SIMA CHECK</div>
              <div className="text-slate-500 text-xs">Backoffice</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                page === item.id
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-amber-400">CM</div>
            <div className="min-w-0">
              <div className="text-slate-200 text-xs font-medium truncate">Carlos Méndez</div>
              <div className="text-slate-500 text-xs">Administrador</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-slate-900/50 border-b border-slate-700 flex items-center justify-between px-6 flex-shrink-0">
          <h1 className="text-white font-semibold text-base">
            {NAV_ITEMS.find((n) => n.id === page)?.label}
          </h1>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400 text-sm">Sistema activo</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
