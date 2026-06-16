import { modules } from '../data/modules'

export default function ModuleSelection({ employee, onSelect, onBack }) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 px-6 pt-8 pb-6">
        <button onClick={onBack} className="text-red-500 text-lg font-semibold mb-5 flex items-center gap-2 touch-manipulation">
          ‹ Cambiar empleado
        </button>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-600/20 border-2 border-red-600 flex items-center justify-center text-red-500 font-black text-xl">
            {employee.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <p className="text-white text-2xl font-bold leading-tight">{employee.name}</p>
            <p className="text-slate-400 text-base">{employee.company}</p>
          </div>
        </div>
        <h2 className="text-white text-2xl font-bold mt-6">Seleccioná un módulo</h2>
        <p className="text-slate-400 text-base">¿Sobre qué área querés evaluarte hoy?</p>
      </div>

      {/* Module Grid */}
      <div className="flex-1 p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {modules.map((mod) => (
          <button
            key={mod.id}
            onClick={() => onSelect(mod)}
            className="group text-left bg-slate-800 border-2 border-slate-700 hover:border-red-600 active:bg-slate-700 rounded-2xl p-6 transition-all duration-150 touch-manipulation"
          >
            <div className="text-5xl mb-4">{mod.icon}</div>
            <h3 className="text-white text-xl font-bold leading-tight mb-2">{mod.name}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{mod.description}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-slate-500 text-xs">{mod.questions.length} preguntas · 3 aleatorias</span>
              <span className="text-red-500 text-xl font-bold group-hover:translate-x-1 transition-transform">›</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
