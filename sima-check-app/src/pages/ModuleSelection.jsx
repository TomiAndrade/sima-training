import { modules } from '../data/modules'

export default function ModuleSelection({ employee, assignments, onSelect, onBack }) {
  const pendingModuleIds = assignments
    .filter((a) => a.employeeId === employee.id && a.status === 'pending')
    .map((a) => a.moduleId)

  const pendingModules = modules.filter((m) => pendingModuleIds.includes(m.id))

  return (
    <div className="w-full max-w-xl bg-slate-900/90 backdrop-blur-sm border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-700/50 flex-shrink-0">
        <button onClick={onBack} className="text-red-500 text-base font-semibold mb-4 flex items-center gap-1 touch-manipulation">
          ‹ Volver
        </button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-600/20 border-2 border-red-600 flex items-center justify-center text-red-500 font-black text-lg flex-shrink-0">
            {employee.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <p className="text-white text-xl font-bold leading-tight">{employee.name}</p>
            <p className="text-slate-400 text-sm">{employee.company}</p>
          </div>
        </div>
        <h2 className="text-white text-lg font-bold mt-4">
          Capacitaciones pendientes ({pendingModules.length})
        </h2>
      </div>

      {/* Module list */}
      <div className="overflow-y-auto flex-1 p-5">
        {pendingModules.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pendingModules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => onSelect(mod)}
                className="group text-left bg-slate-800/60 border border-slate-700 hover:border-red-600 active:bg-slate-700 rounded-xl p-5 transition-all duration-150 touch-manipulation"
              >
                <div className="text-4xl mb-3">{mod.icon}</div>
                <h3 className="text-white text-base font-bold leading-tight mb-1">{mod.name}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{mod.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-slate-500 text-xs">{mod.questions.length} preguntas · 3 aleatorias</span>
                  <span className="text-red-500 text-xl font-bold group-hover:translate-x-1 transition-transform">›</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="text-5xl mb-4">✓</div>
            <p className="text-white text-lg font-bold mb-2">¡Al día!</p>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              No tenés capacitaciones pendientes asignadas.
            </p>
            <button
              onClick={onBack}
              className="mt-6 bg-slate-800 border border-slate-600 hover:border-red-600 text-slate-300 hover:text-white font-semibold px-6 py-3 rounded-xl transition-colors touch-manipulation"
            >
              Volver al inicio
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
