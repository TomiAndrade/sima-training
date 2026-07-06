import { useEffect, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import { modulosApi } from '../../core/api/modulos'
import { useBancoModulo, backendTypeBadge } from '../components/bancoModulo'
import { BancoAcciones } from '../components/BancoPreguntas'

const selectCls = 'bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

function estadoBadge(activa) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${activa ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
      {activa ? 'Activa' : 'Inactiva'}
    </span>
  )
}

// Tabla de preguntas de un módulo (contra el backend). Las preguntas no se
// editan: se activan/desactivan por módulo (baja lógica en el pivot).
// Recibe el `banco` (useBancoModulo) del padre para compartir una sola fuente
// con las acciones del header (crear/asignar refrescan la misma lista).
function QuestionsTable({ moduleId, banco }) {
  const [togglingId, setTogglingId] = useState(null)
  const [toggleError, setToggleError] = useState(null)

  const rows = [...banco.asignadas].sort((a, b) => a.orden - b.orden)

  const handleToggle = async (row) => {
    setTogglingId(row.preguntaId)
    setToggleError(null)
    try {
      await modulosApi.setPreguntaActiva(moduleId, row.preguntaId, !row.activa)
      await banco.refresh()
    } catch (err) {
      setToggleError(err.message)
    } finally {
      setTogglingId(null)
    }
  }

  const columns = [
    {
      key: 'enunciado',
      label: 'Enunciado',
      render: (_, row) => (
        <div className="flex items-start gap-1.5 max-w-md">
          {row.pregunta.imagen && <span className="flex-shrink-0 text-slate-400 text-[11px] mt-0.5">🖼</span>}
          <span className="text-slate-700 line-clamp-2">{row.pregunta.texto}</span>
        </div>
      ),
    },
    { key: 'tipo', label: 'Tipo', render: (_, row) => backendTypeBadge(row.pregunta.tipo) },
    { key: 'estado', label: 'Estado', render: (_, row) => estadoBadge(row.activa) },
  ]

  return (
    <div className="space-y-4">
      {toggleError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{toggleError}</div>
      )}
      <Table
        columns={columns}
        data={rows}
        actions={(row) => (
          <Button
            variant={row.activa ? 'danger' : 'secondary'}
            size="sm"
            disabled={togglingId === row.preguntaId}
            onClick={() => handleToggle(row)}
          >
            {togglingId === row.preguntaId ? '...' : row.activa ? 'Desactivar' : 'Activar'}
          </Button>
        )}
      />
    </div>
  )
}

export default function Questions() {
  const [modules, setModules] = useState([])
  const [moduleId, setModuleId] = useState('')
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    modulosApi
      .list()
      .then((data) => {
        setModules(data)
        if (data.length > 0) setModuleId(data[0].id)
      })
      .catch((err) => setLoadError(err.message))
  }, [])

  // Una sola fuente de verdad para el módulo elegido. Se refresca sola al
  // cambiar moduleId (dependencia del hook) y tras crear/asignar/togglear.
  const banco = useBancoModulo(moduleId)

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest mb-1">Preguntas</div>
          <p className="text-slate-500 text-sm">Preguntas asignadas al módulo. Las preguntas no se editan: se activan o desactivan.</p>
        </div>
        {moduleId && (
          <BancoAcciones
            backendId={moduleId}
            assignedIds={banco.assignedIds}
            baseOrden={banco.baseOrden}
            onChanged={banco.refresh}
          />
        )}
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{loadError}</div>
      )}
      {banco.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{banco.error}</div>
      )}

      <div className="flex items-center gap-2">
        <label className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Módulo</label>
        <select className={selectCls} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
          {modules.length === 0 && <option value="">— Sin módulos —</option>}
          {modules.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
      </div>

      {moduleId && <QuestionsTable moduleId={moduleId} banco={banco} />}
    </div>
  )
}
