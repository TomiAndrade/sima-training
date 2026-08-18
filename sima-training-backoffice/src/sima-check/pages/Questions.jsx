import { useEffect, useMemo, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import MultiSelectFilter from '../../components/MultiSelectFilter'
import { modulosApi } from '../../core/api/modulos'
import { preguntasApi } from '../../core/api/preguntas'
import { basesConocimientoApi } from '../../core/api/basesConocimiento'
import { useBancoModulo, estadoVersionBadge } from '../components/bancoModulo'
import { backendTypeBadge } from '../../core/format/tipoPregunta'
import { BancoAcciones, NuevaPreguntaModal, EditarModulosModal } from '../components/BancoPreguntas'
import ImportPreguntasModal from '../../core/components/ImportPreguntasModal'

// Opción sintética del multi-select de módulos: no es un id real de Modulo,
// se traduce a ?sinAsignar=true en vez de sumarse a moduloId[].
const SIN_ASIGNAR_ID = '__sin_asignar__'
// Opción sintética del filtro de base: no es un id real, se traduce a
// ?sinBase=true. Es el backlog de preguntas cargadas antes de que existieran
// las bases de conocimiento.
const SIN_CLASIFICAR_ID = '__sin_clasificar__'

// Orden de los módulos de una pregunta para la columna "Módulos": primero
// aquellos donde la pregunta está ACTIVA, y entre esos por nombre.
//
// Hace falta ordenar en el cliente porque el backend no garantiza ninguno: el
// findMany de los pivots (preguntas.service.ts) no lleva `orderBy`, así que el
// orden es el que devuelva Postgres y puede cambiar entre requests. Con la
// columna mostrando todos los badges eso pasaba desapercibido; mostrando uno
// solo + "+N" haría que cambie CUÁL es el visible entre dos cargas.
//
// Las activas van primero para que un módulo tachado nunca quede como la única
// cara visible mientras el "+N" esconde los activos — que es la lectura al
// revés de lo que la fila quiere decir. No es "el módulo al que se asignó
// primero" (el pivot no guarda ningún timestamp, así que ese dato no existe).
function ordenarModulos(modulos) {
  return [...(modulos ?? [])].sort((a, b) => {
    if (a.activaEnModulo !== b.activaEnModulo) return a.activaEnModulo ? -1 : 1
    return (a.moduloNombre ?? '').localeCompare(b.moduloNombre ?? '', 'es')
  })
}

// El badge de un módulo en esa columna. Tachado = la pregunta está desactivada
// en ese módulo (baja lógica por módulo, distinta de la papelera global).
function badgeModulo(m) {
  return (
    <span
      key={m.moduloId}
      className={`px-1.5 py-0.5 rounded text-[10px] bg-slate-100 ${m.activaEnModulo ? 'text-slate-500' : 'text-slate-400 line-through'}`}
    >
      {m.moduloNombre}
    </span>
  )
}

function estadoBadge(activa) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${activa ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
      {activa ? 'Activa' : 'Inactiva'}
    </span>
  )
}

// Estado global del banco (papelera), distinto de la baja lógica por módulo:
// activa=false a este nivel significa que está en la papelera, no solo
// desactivada en un módulo puntual.
function estadoPapeleraBadge(activa) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${activa ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
      {activa ? 'Activa' : 'En papelera'}
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
    {
      key: 'estado',
      label: 'Estado',
      render: (_, row) => (row.pregunta.activa === false ? estadoPapeleraBadge(false) : estadoBadge(row.activa)),
    },
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
        actions={(row) =>
          row.pregunta.activa === false ? (
            <span className="text-slate-400 text-xs">Recuperala desde Preguntas</span>
          ) : (
            <Button variant={row.activa ? 'danger' : 'secondary'} size="sm" disabled={togglingId === row.preguntaId} onClick={() => handleToggle(row)}>
              {togglingId === row.preguntaId ? '...' : row.activa ? 'Desactivar' : 'Activar'}
            </Button>
          )
        }
      />
    </div>
  )
}

// Camino global: 0 o 2+ módulos seleccionados, o Papelera activa. Contra
// GET /preguntas con activa/moduloId[]. Acción única: papelera/recuperar
// (global, con cascada en el backend).
function QuestionsTableGlobal({ selectedModuleIds, sinAsignar, showActivas, showPapelera, search, baseId, nivelId, sinBase }) {
  const [preguntas, setPreguntas] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [trashModal, setTrashModal] = useState(null)
  const [trashing, setTrashing] = useState(false)
  const [trashError, setTrashError] = useState(null)

  // Qué filas tienen desplegada la lista completa de módulos. Mismo patrón
  // (y mismo chip `+N`/`−`) que los pares adicionales de Usuarios.jsx.
  const [expandidos, setExpandidos] = useState(() => new Set())
  const toggleExpandido = (id) =>
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const activaParam = showActivas && showPapelera ? undefined : showActivas ? true : showPapelera ? false : undefined

  const load = () => {
    setLoading(true)
    setError(null)
    preguntasApi
      .list({
        q: search.trim() || undefined,
        activa: activaParam,
        moduloId: [...selectedModuleIds],
        sinAsignar,
        baseId,
        nivelId,
        sinBase,
      })
      .then(setPreguntas)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModuleIds, sinAsignar, showActivas, showPapelera, search, baseId, nivelId, sinBase])

  // Recuperar es instantáneo (no cascadea a otros módulos). Enviar a
  // papelera sí cascadea, así que pide confirmación — salvo que la pregunta
  // no esté asignada activamente a ningún módulo, donde no hay nada que advertir.
  const handleToggle = async (row) => {
    const modulosAfectados = (row.modulos ?? []).filter((m) => m.activaEnModulo)
    if (row.activa && modulosAfectados.length > 0) {
      setTrashError(null)
      setTrashModal(row)
      return
    }

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

  const confirmarPapelera = async () => {
    setTrashing(true)
    setTrashError(null)
    try {
      await preguntasApi.setActiva(trashModal.id, false)
      setTrashModal(null)
      load()
    } catch (err) {
      setTrashError(err.message)
    } finally {
      setTrashing(false)
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
      key: 'clasificacion',
      label: 'Base · Nivel',
      render: (_, row) =>
        row.base ? (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-600 font-medium">
              {row.base.nombre}
            </span>
            {row.nivel && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500">
                {row.nivel.nombre}
              </span>
            )}
          </div>
        ) : (
          <span className="text-amber-600 text-xs">Sin clasificar</span>
        ),
    },
    {
      key: 'modulos',
      label: 'Módulos',
      render: (_, row) => {
        const todos = ordenarModulos(row.modulos)
        if (todos.length === 0) return <span className="text-slate-400 text-xs">— Sin asignar —</span>
        const [primero, ...resto] = todos
        const abierto = expandidos.has(row.id)
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              {badgeModulo(primero)}
              {resto.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleExpandido(row.id)}
                  title={abierto ? 'Ocultar los demás módulos' : 'Ver los demás módulos'}
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  {abierto ? '−' : `+${resto.length}`}
                </button>
              )}
            </div>
            {abierto && (
              <div className="flex flex-col items-start gap-1">
                {resto.map((m) => badgeModulo(m))}
              </div>
            )}
          </div>
        )
      },
    },
    { key: 'estado', label: 'Estado', render: (_, row) => estadoPapeleraBadge(row.activa) },
  ]

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>}
      {loading && <div className="text-slate-400 text-xs font-mono">Cargando...</div>}
      {/* alignTop por el mismo motivo que Usuarios.jsx: la celda de Módulos
          crece al desplegar el "+N", y sin esto el resto de la fila se
          centra contra la celda alta y el primer módulo queda desalineado
          del enunciado. Con filas de una línea no cambia nada. */}
      <Table
        alignTop
        columns={columns}
        data={preguntas}
        actions={(row) => (
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditRow(row)}>Editar módulos</Button>
            <Button variant={row.activa ? 'danger' : 'secondary'} size="sm" disabled={togglingId === row.id} onClick={() => handleToggle(row)}>
              {togglingId === row.id ? '...' : row.activa ? 'Enviar a papelera' : 'Recuperar'}
            </Button>
          </>
        )}
      />

      {editRow && (
        <EditarModulosModal
          pregunta={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            load()
            setEditRow(null)
          }}
        />
      )}

      <Modal
        open={!!trashModal}
        onClose={() => setTrashModal(null)}
        title="Enviar a papelera"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTrashModal(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmarPapelera} disabled={trashing}>
              {trashing ? 'Guardando...' : 'Enviar a papelera'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {trashError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{trashError}</div>
          )}
          <p className="text-slate-600 text-sm line-clamp-2">
            Vas a enviar a papelera: <span className="font-semibold">{trashModal?.texto}</span>
          </p>
          <p className="text-slate-500 text-xs">Se desactiva en los siguientes módulos:</p>
          <ul className="space-y-1.5">
            {(trashModal?.modulos ?? [])
              .filter((m) => m.activaEnModulo)
              .map((m) => (
                <li key={m.moduloId} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                  <div>
                    <div className="text-slate-800 text-sm font-medium">{m.moduloNombre}</div>
                    {m.totalActivasEnModulo === 1 && (
                      <div className="text-red-600 text-xs font-semibold">Se queda sin preguntas activas</div>
                    )}
                  </div>
                  {estadoVersionBadge(m.estadoModulo)}
                </li>
              ))}
          </ul>
        </div>
      </Modal>
    </div>
  )
}

export default function Questions() {
  const [modules, setModules] = useState([])
  const [bases, setBases] = useState([])
  // Filtro de clasificación. Es un select simple y no un MultiSelectFilter
  // porque la API toma un `baseId` único, y sobre todo porque un nivel sólo
  // existe dentro de una base: con varias bases elegidas el filtro de nivel no
  // significaría nada. El valor SIN_CLASIFICAR_ID es sintético → ?sinBase=true.
  const [baseFiltro, setBaseFiltro] = useState('')
  const [nivelFiltro, setNivelFiltro] = useState('')
  const [selectedModuleIds, setSelectedModuleIds] = useState(new Set())
  const [showActivas, setShowActivas] = useState(true)
  const [showPapelera, setShowPapelera] = useState(false)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    modulosApi.list().then(setModules).catch((err) => setLoadError(err.message))
    // Catálogo completo (no ?activa=true): hace falta para poder seguir
    // filtrando por una base que se dio de baja pero cuyas preguntas siguen ahí.
    basesConocimientoApi.list().then(setBases).catch(() => {})
  }, [])

  const baseFiltroObj = useMemo(
    () => bases.find((b) => b.id === baseFiltro) ?? null,
    [bases, baseFiltro],
  )
  const sinBase = baseFiltro === SIN_CLASIFICAR_ID

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
  // El filtro de clasificación también fuerza el camino global: la vista
  // por-módulo lista los pivots de esa versión y no sabe filtrar por base/nivel
  // (mismo criterio que el buscador de texto).
  const usaCaminoModulo = realModuleIds.size === 1 && !sinAsignar && showActivas && !showPapelera && !search.trim() && !baseFiltro
  const soloModuleId = usaCaminoModulo ? [...realModuleIds][0] : null

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest mb-1">Preguntas</div>
          <p className="text-slate-500 text-sm">Banco de preguntas. Activá/desactivá por módulo o enviá a la papelera global.</p>
        </div>
        <div className="flex items-center gap-2">
          {!usaCaminoModulo && (
            <Button variant="secondary" onClick={() => setNuevaOpen(true)}>Nueva pregunta</Button>
          )}
          <Button variant="secondary" onClick={() => setImportOpen(true)}>Importar Excel</Button>
        </div>
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
        <select
          className="bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
          value={baseFiltro}
          // Cambiar de base descarta el nivel: los niveles pertenecen a una base.
          onChange={(e) => { setBaseFiltro(e.target.value); setNivelFiltro('') }}
        >
          <option value="">Todas las bases</option>
          <option value={SIN_CLASIFICAR_ID}>— Sin clasificar —</option>
          {bases.map((b) => (
            <option key={b.id} value={b.id}>{b.nombre}{!b.activa ? ' (inactiva)' : ''}</option>
          ))}
        </select>
        <select
          className="bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600 disabled:bg-slate-50 disabled:text-slate-400"
          value={nivelFiltro}
          onChange={(e) => setNivelFiltro(e.target.value)}
          disabled={!baseFiltroObj || (baseFiltroObj.niveles?.length ?? 0) === 0}
        >
          <option value="">Todos los niveles</option>
          {(baseFiltroObj?.niveles ?? []).map((n) => (
            <option key={n.id} value={n.id}>{n.nombre}</option>
          ))}
        </select>
        <ChipToggle active={showActivas} onClick={toggleActivas}>Activas</ChipToggle>
        <ChipToggle active={showPapelera} onClick={togglePapelera}>Papelera</ChipToggle>
      </div>

      {usaCaminoModulo ? (
        <QuestionsTableModulo key={`m-${reloadKey}`} moduleId={soloModuleId} />
      ) : (
        <QuestionsTableGlobal
          key={`g-${reloadKey}`}
          selectedModuleIds={realModuleIds}
          sinAsignar={sinAsignar}
          showActivas={showActivas}
          showPapelera={showPapelera}
          search={search}
          baseId={sinBase ? undefined : baseFiltro || undefined}
          nivelId={nivelFiltro || undefined}
          sinBase={sinBase || undefined}
        />
      )}

      <ImportPreguntasModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => setReloadKey((k) => k + 1)}
      />

      {nuevaOpen && (
        <NuevaPreguntaModal
          onClose={() => setNuevaOpen(false)}
          onAssigned={() => {
            setReloadKey((k) => k + 1)
            setNuevaOpen(false)
          }}
        />
      )}
    </div>
  )
}
