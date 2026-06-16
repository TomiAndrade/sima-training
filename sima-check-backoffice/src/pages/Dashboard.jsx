import StatCard from '../components/StatCard'
import { companies } from '../data/companies'
import { users } from '../data/users'
import { modules } from '../data/modules'
import { evaluations } from '../data/evaluations'
import { assignments } from '../data/assignments'

const moduleNames = ['SIMA Básico', 'SIMA Intermedio', 'SIMA Avanzado', 'Reglas de Oro Industria Petrolera']
const shortNames = ['Básico', 'Intermedio', 'Avanzado', 'Reglas de Oro']

function ApprovalChart() {
  const stats = moduleNames.map((name, i) => {
    const evals = evaluations.filter((e) => e.moduleName === name)
    const approved = evals.filter((e) => e.approved).length
    const pct = evals.length ? Math.round((approved / evals.length) * 100) : 0
    return { name: shortNames[i], pct }
  })

  const maxPct = 100
  const chartH = 140

  return (
    <div className="flex items-end justify-around gap-4 pt-4" style={{ height: chartH + 40 }}>
      {stats.map((s) => {
        const barH = Math.round((s.pct / maxPct) * chartH)
        const color = s.pct >= 70 ? '#10b981' : '#f59e0b'
        return (
          <div key={s.name} className="flex flex-col items-center gap-2 flex-1">
            <span className="text-xs font-semibold" style={{ color }}>{s.pct}%</span>
            <div
              className="w-full rounded-t-md transition-all duration-700"
              style={{ height: barH, backgroundColor: color, minHeight: 4 }}
            />
            <span className="text-slate-400 text-xs text-center leading-tight">{s.name}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const activeCompanies = companies.filter((c) => c.active).length
  const totalUsers = users.length
  const activeModules = modules.filter((m) => m.active).length
  const approvedPct = Math.round((evaluations.filter((e) => e.approved).length / evaluations.length) * 100)
  const pendingAssignments = assignments.filter((a) => a.status === 'pending').length
  const completedAssignments = assignments.filter((a) => a.status === 'completed').length

  const recent = [...evaluations].sort((a, b) => b.id - a.id).slice(0, 7)

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard label="Empresas activas" value={activeCompanies} icon="🏢" delta="+1 este mes" deltaPositive />
        <StatCard label="Usuarios registrados" value={totalUsers} icon="👤" delta="+3 este mes" deltaPositive />
        <StatCard label="Módulos activos" value={activeModules} icon="📋" />
        <StatCard label="% Aprobación general" value={`${approvedPct}%`} icon="✓" delta={approvedPct >= 70 ? 'Óptimo' : 'Por mejorar'} deltaPositive={approvedPct >= 70} />
        <StatCard label="Asignaciones pendientes" value={pendingAssignments} icon="📌" delta="Por completar" />
        <StatCard label="Asignaciones completadas" value={completedAssignments} icon="✓" deltaPositive />
      </div>

      {/* Chart + Recent */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-1">Aprobación por módulo</h3>
          <p className="text-slate-400 text-xs mb-4">Porcentaje de evaluaciones aprobadas</p>
          <ApprovalChart />
        </div>

        {/* Recent evaluations */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Últimas evaluaciones</h3>
          <div className="space-y-2">
            {recent.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                <div className="min-w-0">
                  <p className="text-slate-200 text-sm font-medium truncate">{ev.employeeName}</p>
                  <p className="text-slate-500 text-xs truncate">{ev.moduleName} · {ev.date}</p>
                </div>
                <span className={`ml-3 flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${ev.approved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
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
