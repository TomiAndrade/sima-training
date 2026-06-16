import { useState } from 'react'
import { employees } from '../data/employees'

export default function EmployeeSelection({ onSelect }) {
  const [search, setSearch] = useState('')

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.company.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 px-6 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-lg">S</div>
          <div>
            <div className="font-bold text-white text-lg leading-tight">SIMA CHECK</div>
            <div className="text-slate-500 text-sm">Ingeniería Sima</div>
          </div>
        </div>
        <h1 className="text-white text-3xl font-bold mb-1">Seleccioná tu nombre</h1>
        <p className="text-slate-400 text-lg">Buscá por nombre o empresa</p>
        <div className="mt-5 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empleado..."
            className="w-full bg-slate-800 border-2 border-slate-600 rounded-2xl py-4 pl-12 pr-5 text-white text-xl focus:outline-none focus:border-amber-500 placeholder-slate-500"
            autoFocus
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {filtered.map((emp) => (
          <button
            key={emp.id}
            onClick={() => onSelect(emp)}
            className="w-full text-left bg-slate-800 border-2 border-slate-700 hover:border-amber-500 active:bg-slate-700 rounded-2xl px-5 py-4 transition-all duration-150 touch-manipulation"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-amber-500 font-bold text-lg flex-shrink-0">
                {emp.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-lg leading-tight truncate">{emp.name}</p>
                <p className="text-slate-400 text-sm truncate">{emp.company}</p>
              </div>
              <span className="ml-auto text-slate-500 text-2xl flex-shrink-0">›</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-xl">Sin resultados</p>
          </div>
        )}
      </div>
    </div>
  )
}
