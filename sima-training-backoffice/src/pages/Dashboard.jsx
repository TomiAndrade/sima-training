import StatCard from '../components/StatCard'
import { companies } from '../core/data/companies'
import { users } from '../core/data/users'
import { trainingModules } from '../sima-check/data/training-modules'
import { trainingAssignments } from '../sima-check/data/training-assignments'

function ProductCard({ name, description, active, stats = [], onNavigate }) {
  return (
    <div className={`bg-slate-800 border rounded-xl p-5 flex flex-col gap-4 ${active ? 'border-slate-700' : 'border-slate-700/50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-bold text-base">{name}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600 text-slate-400'}`}>
              {active ? 'Activo' : 'Próximamente'}
            </span>
          </div>
          <p className="text-slate-400 text-sm">{description}</p>
        </div>
        <div className="w-10 h-10 bg-red-600/10 border border-red-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-red-400 font-black text-sm">S</span>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="flex gap-4">
          {stats.map((s) => (
            <div key={s} className="text-slate-400 text-xs">{s}</div>
          ))}
        </div>
      )}

      {active && onNavigate && (
        <button
          onClick={onNavigate}
          className="mt-auto w-full py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
        >
          Abrir SIMA CHECK →
        </button>
      )}
    </div>
  )
}

export default function Dashboard({ navigate }) {
  const totalCompanies = companies.filter((c) => c.active).length
  const totalUsers = users.length
  const activeModules = trainingModules.filter((m) => m.active).length
  const pendingAssignments = trainingAssignments.filter((a) => a.status === 'pending').length

  return (
    <div className="space-y-8">
      {/* Platform header */}
      <div>
        <h2 className="text-white font-bold text-2xl">SIMA TRAINING</h2>
        <p className="text-slate-400 text-sm mt-1">Plataforma de gestión y capacitación industrial</p>
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Empresas activas" value={totalCompanies} icon="🏢" />
        <StatCard label="Usuarios registrados" value={totalUsers} icon="👤" />
      </div>

      {/* Products */}
      <div>
        <h3 className="text-slate-300 font-semibold text-sm uppercase tracking-wider mb-4">Productos disponibles</h3>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <ProductCard
            name="SIMA CHECK"
            description="Capacitaciones y evaluaciones industriales"
            active={true}
            stats={[`${activeModules} módulos activos`, `${pendingAssignments} asignaciones pendientes`]}
            onNavigate={() => navigate('sima-check-overview')}
          />
          <ProductCard
            name="SIMA INSPECTIONS"
            description="Gestión de inspecciones en campo"
            active={false}
          />
          <ProductCard
            name="SIMA AUDITS"
            description="Auditorías de seguridad y calidad"
            active={false}
          />
        </div>
      </div>
    </div>
  )
}
