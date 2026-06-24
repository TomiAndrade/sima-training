import StatCard from '../../components/StatCard'
import { clients } from '../../core/data/clients'
import { users } from '../../core/data/users'
import { trainingModules as modules } from '../data/training-modules'
import { evaluations } from '../data/evaluations'
import { trainingAssignments as assignments } from '../data/training-assignments'

const moduleNames = ['SIMA Básico', 'SIMA Intermedio', 'SIMA Avanzado', 'Reglas de Oro Industria Petrolera']
const shortNames = ['Básico', 'Intermedio', 'Avanzado', 'Reglas de Oro']

function ApprovalChart() {
  const stats = moduleNames.map((name, i) => {
    const evals = evaluations.filter((e) => e.moduleName === name)
    const approved = evals.filter((e) => e.approved).length
    const pct = evals.length ? Math.round((approved / evals.length) * 100) : 0
    return { name: shortNames[i], pct }
  })

  const chartH = 140

  return (
    <div className="flex items-end justify-around gap-4 pt-4" style={{ height: chartH + 40 }}>
      {stats.map((s) => {
        const barH = Math.round((s.pct / 100) * chartH)
        const color = s.pct >= 70 ? '#059669' : '#d97706'
        return (
          <div key={s.name} className="flex flex-col items-center gap-2 flex-1">
            <span className="text-xs font-semibold font-mono" style={{ color }}>{s.pct}%</span>
            <div
              className="w-full rounded-t transition-all duration-700"
              style={{ height: barH, backgroundColor: color, minHeight: 4 }}
            />
            <span className="text-slate-400 text-[10px] text-center leading-tight uppercase tracking-wide">{s.name}</span>
          </div>
        )
      })}
    </div>
  )
}

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">{children}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  )
}

export default function Overview() {
  const activeClients = clients.filter((c) => c.active).length
  const totalUsers = users.length
  const activeModules = modules.filter((m) => m.active).length
  const approvedPct = Math.round((evaluations.filter((e) => e.approved).length / evaluations.length) * 100)
  const pendingAssignments = assignments.filter((a) => a.status === 'pending').length
  const completedAssignments = assignments.filter((a) => a.status === 'completed').length

  const recent = [...evaluations].sort((a, b) => b.id - a.id).slice(0, 7)

  return (
    <div className="space-y-7 max-w-6xl">

      {/* KPI Cards */}
      <div>
        <SectionHeader>Métricas Operacionales</SectionHeader>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          <StatCard label="Clientes activos" value={activeClients} delta="+1 este mes" deltaPositive />
          <StatCard label="Usuarios registrados" value={totalUsers} delta="+3 este mes" deltaPositive />
          <StatCard label="Módulos activos" value={activeModules} />
          <StatCard label="% Aprobación general" value={`${approvedPct}%`} delta={approvedPct >= 70 ? 'Óptimo' : 'Por mejorar'} deltaPositive={approvedPct >= 70} />
          <StatCard label="Asignaciones pendientes" value={pendingAssignments} delta="Por completar" />
          <StatCard label="Asignaciones completadas" value={completedAssignments} delta="Historial total" deltaPositive />
        </div>
      </div>

      {/* Chart + Recent evaluations */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Chart */}
        <div>
          <SectionHeader>Aprobación por Módulo</SectionHeader>
          <div className="bg-white border border-slate-200 rounded p-5 shadow-sm">
            <p className="text-slate-400 text-[10px] font-mono uppercase tracking-widest mb-4">
              % evaluaciones aprobadas por capacitación
            </p>
            <ApprovalChart />
          </div>
        </div>

        {/* Recent evaluations */}
        <div>
          <SectionHeader>Últimas Evaluaciones</SectionHeader>
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            {recent.map((ev, i) => (
              <div
                key={ev.id}
                className={`flex items-center justify-between px-4 py-3 ${i < recent.length - 1 ? 'border-b border-slate-200/60' : ''} hover:bg-slate-50 transition-colors`}
              >
                <div className="min-w-0">
                  <p className="text-slate-800 text-sm font-medium truncate">{ev.employeeName}</p>
                  <p className="text-slate-400 text-[10px] font-mono uppercase tracking-wide truncate">
                    {ev.moduleName} · {ev.date}
                  </p>
                </div>
                <span className={`ml-3 flex-shrink-0 px-2 py-1 rounded text-[11px] font-bold font-mono border ${
                  ev.approved
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                  {ev.score}%
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
