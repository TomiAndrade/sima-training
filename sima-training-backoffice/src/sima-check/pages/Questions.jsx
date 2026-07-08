import { useEffect, useMemo, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import MultiSelectFilter from '../../components/MultiSelectFilter'
import { modulosApi } from '../../core/api/modulos'
import { preguntasApi } from '../../core/api/preguntas'
import { useBancoModulo, backendTypeBadge } from '../components/bancoModulo'
import { BancoAcciones } from '../components/BancoPreguntas'

// Opción sintética del multi-select de módulos: no es un id real de Modulo,
// se traduce a ?sinAsignar=true en vez de sumarse a moduloId[].
const SIN_ASIGNAR_ID = '__sin_asignar__'

function estadoBadge(activa) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${activa ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
      {activa ? 'Activa' : 'Inactiva'}
    </span>
  )
}

function ChipToggle({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        active ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-slate-400 border-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

// Camino Story-2 (sin cambios de lógica): exactamente 1 módulo seleccionado y
// papelera no forzada. Reusa useBancoModulo y el toggle por-módulo tal cual.
function QuestionsTableModulo({ moduleId }) {
  const banco = useBancoModulo(moduleId)
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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div />
        <BancoAcciones backendId={moduleId} assignedIds={banco.assignedIds} baseOrden={banco.baseOrden} onChanged={banco.refresh} />
      </div>
      {banco.error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{banco.error}</div>}
      {toggleError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{toggleError}</div>}
      <Table
        columns={columns}
        data={rows}
        actions={(row) => (
          <Button variant={row.activa ? 'danger' : 'secondary'} size="sm" disabled={togglingId === row.preguntaId} onClick={() => handleToggle(row)}>
            {togglingId === row.preguntaId ? '...' : row.activa ? 'Desactivar' : 'Activar'}
          </Button>
        )}
      />
    </div>
  )
}

// Camino global: 0 o 2+ módulos seleccionados, o Papelera activa. Contra
// GET /preguntas con activa/moduloId[]. Acción única: papelera/recuperar
// (global, con cascada en el backend).
function QuestionsTableGlobal({ selectedModuleIds, sinAsignar, showActivas, showPapelera, search }) {
  const [preguntas, setPreguntas] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const activaParam = showActivas && showPapelera ? undefined : showActivas ? true : showPapelera ? false : undefined

  const load = () => {
    setLoading(true)
    setError(null)
    preguntasApi
      .list({ q: search.trim() || undefined, activa: activaParam, moduloId: [...selectedModuleIds], sinAsignar })
      .then(setPreguntas)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModuleIds, sinAsignar, showActivas, showPapelera, search])

  const handleToggle = async (row) => {
    setTogglingId(row.id)
    setError(null)
    try {
      await preguntasApi.setActiva(row.id, !row.activa)
      load()
    } catch (err) {
      setError(err.message)
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
          {row.imagen && <span className="flex-shrink-0 text-slate-400 text-[11px] mt-0.5">🖼</span>}
          <span className="text-slate-700 line-clamp-2">{row.texto}</span>
        </div>
      ),
    },
    { key: 'tipo', label: 'Tipo', render: (_, row) => backendTypeBadge(row.tipo) },
    {
      key: 'modulos',
      label: 'Módulos',
      render: (_, row) => (
        <div className="flex flex-wrap gap-1">
          {(row.modulos ?? []).length === 0 && <span className="text-slate-400 text-xs">— Sin asignar —</span>}
          {(row.modulos ?? []).map((m) => (
            <span
              key={m.moduloId}
              className={`px-1.5 py-0.5 rounded text-[10px] bg-slate-100 ${m.activaEnModulo ? 'text-slate-500' : 'text-slate-400 line-through'}`}
            >
              {m.moduloNombre}
            </span>
          ))}
        </div>
      ),
    },
    { key: 'estado', label: 'Estado', render: (_, row) => estadoBadge(row.activa) },
  ]

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>}
      {loading && <div className="text-slate-400 text-xs font-mono">Cargando...</div>}
      <Table
        columns={columns}
        data={preguntas}
        actions={(row) => (
          <Button variant={row.activa ? 'danger' : 'secondary'} size="sm" disabled={togglingId === row.id} onClick={() => handleToggle(row)}>
            {togglingId === row.id ? '...' : row.activa ? 'Enviar a papelera' : 'Recuperar'}
          </Button>
        )}
      />
    </div>
  )
}

export default function Questions() {
  const [modules, setModules] = useState([])
  const [selectedModuleIds, setSelectedModuleIds] = useState(new Set())
  const [showActivas, setShowActivas] = useState(true)
  const [showPapelera, setShowPapelera] = useState(false)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    modulosApi.list().then(setModules).catch((err) => setLoadError(err.message))
  }, [])

  const moduleOptions = useMemo(
    () => [{ id: SIN_ASIGNAR_ID, label: '— Sin asignar —' }, ...modules.map((m) => ({ id: m.id, label: m.nombre }))],
    [modules],
  )

  const sinAsignar = selectedModuleIds.has(SIN_ASIGNAR_ID)
  const realModuleIds = useMemo(
    () => new Set([...selectedModuleIds].filter((id) => id !== SIN_ASIGNAR_ID)),
    [selectedModuleIds],
  )

  // No permite apagar un chip si es el único encendido (evita "ambos off" =
  // "trae todo" sin que el usuario lo haya elegido explícitamente).
  const toggleActivas = () => {
    if (showActivas && !showPapelera) return
    setShowActivas((v) => !v)
  }
  const togglePapelera = () => {
    if (showPapelera && !showActivas) return
    setShowPapelera((v) => !v)
  }

  // Camino Story-2 solo con exactamente 1 módulo REAL (no "Sin asignar"),
  // papelera no forzada y sin búsqueda de texto (el buscador es universal →
  // siempre usa el camino global).
  const usaCaminoModulo = realModuleIds.size === 1 && !sinAsignar && showActivas && !showPapelera && !search.trim()
  const soloModuleId = usaCaminoModulo ? [...realModuleIds][0] : null

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest mb-1">Preguntas</div>
        <p className="text-slate-500 text-sm">Banco de preguntas. Activá/desactivá por módulo o enviá a la papelera global.</p>
      </div>

      {loadError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{loadError}</div>}

      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600 min-w-[240px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por enunciado..."
        />
        <MultiSelectFilter options={moduleOptions} selectedIds={selectedModuleIds} onChange={setSelectedModuleIds} placeholder="Todos los módulos" />
        <ChipToggle active={showActivas} onClick={toggleActivas}>Activas</ChipToggle>
        <ChipToggle active={showPapelera} onClick={togglePapelera}>Papelera</ChipToggle>
      </div>

      {usaCaminoModulo ? (
        <QuestionsTableModulo moduleId={soloModuleId} />
      ) : (
        <QuestionsTableGlobal
          selectedModuleIds={realModuleIds}
          sinAsignar={sinAsignar}
          showActivas={showActivas}
          showPapelera={showPapelera}
          search={search}
        />
      )}
    </div>
  )
}
