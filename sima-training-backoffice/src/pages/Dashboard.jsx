import { companies } from '../core/data/companies'
import { users } from '../core/data/users'
import { employees } from '../core/data/employees'
import { trainingModules } from '../sima-check/data/training-modules'
import { trainingAssignments } from '../sima-check/data/training-assignments'

const RECENT_ACTIVITY = [
  { date: '16/06', time: '14:23', user: 'C. Méndez', action: 'Asignación creada', detail: 'García, L. → SIMA Avanzado' },
  { date: '16/06', time: '13:45', user: 'M. González', action: 'Evaluación completada', detail: 'Score: 100% — APROBADO' },
  { date: '16/06', time: '11:30', user: 'C. Méndez', action: 'Usuario registrado', detail: 'López, R. — Coordinador' },
  { date: '15/06', time: '16:12', user: 'A. Torres', action: 'Asignación creada', detail: 'Romero, P. → Reglas de Oro' },
  { date: '15/06', time: '15:44', user: 'M. González', action: 'Evaluación completada', detail: 'Score: 67% — DESAPROBADO' },
  { date: '15/06', time: '10:22', user: 'C. Méndez', action: 'Empresa activada', detail: 'Vista Energy → Activa' },
]

const SYSTEM_STATUS = [
  { label: 'Base de datos', status: 'OPERATIVO', ok: true },
  { label: 'Módulos SIMA CHECK', status: 'OPERATIVO', ok: true },
  { label: 'Servicios de plataforma', status: 'OPERATIVO', ok: true },
  { label: 'Integraciones externas', status: 'ADVERTENCIA', ok: false },
]

function StatusDot({ ok }) {
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
  )
}

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">{children}</span>
      <div className="flex-1 h-px bg-zinc-800" />
    </div>
  )
}

export default function Dashboard({ navigate }) {
  const activeCompanies = companies.filter((c) => c.active).length
  const totalEmployees = employees.length
  const pendingAssignments = trainingAssignments.filter((a) => a.status === 'pending').length
  const completedAssignments = trainingAssignments.filter((a) => a.status === 'completed').length
  const activeModules = trainingModules.filter((m) => m.active).length

  return (
    <div className="space-y-7 max-w-6xl">

      {/* Resumen operacional */}
      <div>
        <SectionHeader>Resumen Operacional</SectionHeader>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: 'Empresas Activas', value: activeCompanies },
            { label: 'Empleados Registrados', value: totalEmployees },
            { label: 'Asignaciones Pendientes', value: pendingAssignments },
            { label: 'Capacitaciones Completadas', value: completedAssignments },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-zinc-900 border border-zinc-800 rounded p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-900/60 via-zinc-700 to-transparent" />
              <div className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-2">{kpi.label}</div>
              <div className="text-3xl font-bold text-white font-mono leading-none">{kpi.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actividad reciente + Estado del sistema */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Actividad reciente */}
        <div className="xl:col-span-2">
          <SectionHeader>Actividad Reciente</SectionHeader>
          <div className="border border-zinc-800 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800">
                  {['Fecha', 'Usuario', 'Acción', 'Detalle'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-zinc-500 font-semibold uppercase tracking-widest text-[10px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECENT_ACTIVITY.map((ev, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-zinc-500 whitespace-nowrap">
                      {ev.date} <span className="text-zinc-700">{ev.time}</span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-300 whitespace-nowrap">{ev.user}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{ev.action}</td>
                    <td className="px-4 py-2.5 text-zinc-600">{ev.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Estado del sistema */}
        <div>
          <SectionHeader>Estado del Sistema</SectionHeader>
          <div className="bg-zinc-900 border border-zinc-800 rounded divide-y divide-zinc-800">
            {SYSTEM_STATUS.map((s) => (
              <div key={s.label} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <StatusDot ok={s.ok} />
                  <span className="text-zinc-400 text-xs">{s.label}</span>
                </div>
                <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider ${s.ok ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Productos de la plataforma */}
      <div>
        <SectionHeader>Productos de la Plataforma</SectionHeader>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* SIMA CHECK — activo */}
          <div className="bg-zinc-900 border border-zinc-800 rounded p-5 flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-red-600/60" />
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold text-sm tracking-wide">SIMA CHECK</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-mono font-semibold uppercase tracking-wider">
                    Activo
                  </span>
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed">Capacitaciones y evaluaciones industriales</p>
              </div>
              <div className="w-8 h-8 bg-red-600/10 border border-red-900/50 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-red-500 font-bold text-[11px] font-mono">SC</span>
              </div>
            </div>
            <div className="flex gap-4">
              <div>
                <div className="text-zinc-600 text-[10px] uppercase tracking-widest">Módulos</div>
                <div className="text-white font-mono font-bold text-lg">{activeModules}</div>
              </div>
              <div>
                <div className="text-zinc-600 text-[10px] uppercase tracking-widest">Pendientes</div>
                <div className="text-white font-mono font-bold text-lg">{pendingAssignments}</div>
              </div>
              <div>
                <div className="text-zinc-600 text-[10px] uppercase tracking-widest">Completadas</div>
                <div className="text-white font-mono font-bold text-lg">{completedAssignments}</div>
              </div>
            </div>
            <button
              onClick={() => navigate('sima-check-overview')}
              className="mt-auto w-full py-2 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold uppercase tracking-widest transition-colors"
            >
              Abrir SIMA CHECK →
            </button>
          </div>

          {/* SIMA INSPECTIONS — roadmap */}
          {[
            { code: 'SI', name: 'SIMA INSPECTIONS', desc: 'Gestión de inspecciones en campo', eta: 'Q3 2026' },
            { code: 'SA', name: 'SIMA AUDITS', desc: 'Auditorías de seguridad y calidad', eta: 'Q4 2026' },
          ].map((prod) => (
            <div key={prod.code} className="bg-zinc-900/50 border border-zinc-800/60 rounded p-5 flex flex-col gap-4 opacity-60">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-zinc-400 font-semibold text-sm tracking-wide">{prod.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500 text-[10px] font-mono font-semibold uppercase tracking-wider">
                      Roadmap
                    </span>
                  </div>
                  <p className="text-zinc-600 text-xs leading-relaxed">{prod.desc}</p>
                </div>
                <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-zinc-600 font-bold text-[11px] font-mono">{prod.code}</span>
                </div>
              </div>
              <div className="mt-auto">
                <div className="text-zinc-600 text-[10px] uppercase tracking-widest">Disponibilidad estimada</div>
                <div className="text-zinc-400 font-mono font-semibold text-sm mt-0.5">{prod.eta}</div>
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  )
}
