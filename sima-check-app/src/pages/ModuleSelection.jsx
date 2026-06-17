import { modules } from '../data/modules'

export default function ModuleSelection({ employee, assignments, onSelect, onBack }) {
  const pendingModuleIds = assignments
    .filter((a) => a.employeeId === employee.id && a.status === 'pending')
    .map((a) => a.moduleId)

  const pendingModules = modules.filter((m) => pendingModuleIds.includes(m.id))

  return (
    <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-200 flex-shrink-0">
        <button onClick={onBack} className="text-red-600 text-base font-semibold mb-4 flex items-center gap-1 touch-manipulation">
          ‹ Volver
        </button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 border-2 border-red-600 flex items-center justify-center text-red-600 font-black text-lg flex-shrink-0">
            {employee.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <p className="text-slate-900 text-xl font-bold leading-tight">{employee.name}</p>
            <p className="text-slate-500 text-sm">{employee.company}</p>
          </div>
        </div>
        <h2 className="text-slate-900 text-lg font-bold mt-4">
          Capacitaciones pendientes ({pendingModules.length})
        </h2>
      </div>

      {/* Module list */}
      <div className="overflow-y-auto flex-1 p-5">
        {pendingModules.length > 0 ? (
          <div className="flex flex-col gap-3">
            {pendingModules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => onSelect(mod)}
                className="group w-full flex items-center gap-4 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl px-5 py-4 transition-all duration-150 touch-manipulation"
              >
                <span className="text-3xl flex-shrink-0">{mod.icon}</span>
                <span className="flex-1 text-left text-white text-lg font-bold leading-tight">{mod.name}</span>
                <span className="text-white text-2xl font-bold flex-shrink-0 group-hover:translate-x-1 transition-transform">›</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="text-5xl mb-4">✓</div>
            <p className="text-slate-900 text-lg font-bold mb-2">¡Al día!</p>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
              No tenés capacitaciones pendientes asignadas.
            </p>
            <button
              onClick={onBack}
              className="mt-6 bg-white border border-slate-300 hover:border-red-600 text-slate-700 hover:text-red-600 font-semibold px-6 py-3 rounded-xl transition-colors touch-manipulation"
            >
              Volver al inicio
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
