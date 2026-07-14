import { useEffect, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { modulosApi } from '../../core/api/modulos'
import { useBancoModulo, estadoVersionBadge, formatVersionNumero, estadoModulo } from '../components/bancoModulo'
import { BancoAcciones, PreguntasAsignadasPanel, PreguntaBancoPicker } from '../components/BancoPreguntas'

const EMPTY_MODULE_FORM = { nombre: '', descripcion: '', vigenciaMeses: '' }

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

// Calcula el número resultante de activar como actualización (esNuevaLinea=false,
// sube MENOR) o como versión nueva (esNuevaLinea=true, sube MAYOR y resetea MENOR).
// Espeja `calcularNumero` del backend, sólo para mostrar un preview antes de confirmar
// — el número real lo asigna el servidor al activar.
function previewActivacion(vigenteBase, esNuevaLinea) {
  const anioActual = new Date().getFullYear()
  if (!vigenteBase || vigenteBase.anio == null) {
    return { anio: anioActual, mayor: 1, menor: 0 }
  }
  if (esNuevaLinea === false) {
    return { anio: vigenteBase.anio, mayor: vigenteBase.mayor, menor: vigenteBase.menor + 1 }
  }
  const mayor = vigenteBase.anio === anioActual ? vigenteBase.mayor + 1 : 1
  return { anio: anioActual, mayor, menor: 0 }
}

// Umbral para recomendar "versión nueva" en vez de "actualización": si el
// borrador acumula muchos cambios de preguntas respecto a la base de la que
// partió, seguir publicando como "actualización" (misma línea) podría terminar
// en un módulo completamente distinto sin que eso quede reflejado en el
// versionado — nadie elige nunca "versión nueva" y la línea mayor no avanza.
const RECOMENDAR_MIN_CAMBIOS = 2
const RECOMENDAR_PORCENTAJE = 0.3

function contarCambios(baseAsignadas, actualesAsignadas) {
  const base = new Set(baseAsignadas.filter((a) => a.activa).map((a) => a.preguntaId))
  const actuales = new Set(actualesAsignadas.filter((a) => a.activa).map((a) => a.preguntaId))
  const agregadas = [...actuales].filter((id) => !base.has(id)).length
  const quitadas = [...base].filter((id) => !actuales.has(id)).length
  return { total: agregadas + quitadas, baseSize: base.size }
}

function deberiaRecomendarVersionNueva({ total, baseSize }) {
  if (total < RECOMENDAR_MIN_CAMBIOS) return false
  if (baseSize === 0) return true
  return total / baseSize >= RECOMENDAR_PORCENTAJE
}

// Modal: al editar contenido de un módulo con ACTIVO, elegir si el borrador se
// publicará como actualización (sube MENOR) o como versión nueva (sube MAYOR).
function VersionChoiceModal({ mod, onClose, onCreated }) {
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  const elegir = async (esNuevaLinea) => {
    setSaving(esNuevaLinea)
    setError(null)
    try {
      const borrador = await modulosApi.crearVersion(mod.id, esNuevaLinea)
      onCreated(borrador.id)
    } catch (err) {
      setError(err.message)
      setSaving(null)
    }
  }

  const menorPreview = formatVersionNumero(previewActivacion(mod.vigente, false))
  const mayorPreview = formatVersionNumero(previewActivacion(mod.vigente, true))

  return (
    <Modal open onClose={onClose} title="Editar contenido del módulo">
      <div className="space-y-3">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>}
        <p className="text-slate-500 text-sm">
          El módulo ya tiene una versión publicada ({formatVersionNumero(mod.vigente)}). ¿Cómo querés publicar los cambios?
        </p>
        <button
          type="button"
          disabled={saving !== null}
          onClick={() => elegir(false)}
          className="w-full text-left border border-slate-200 rounded px-4 py-3 hover:border-red-600 hover:bg-red-50/30 transition-colors disabled:opacity-50"
        >
          <div className="text-slate-900 font-semibold text-sm">
            {saving === false ? 'Creando borrador...' : 'Actualización (misma versión)'}
          </div>
          <div className="text-slate-400 text-xs font-mono mt-0.5">→ {menorPreview}</div>
        </button>
        <button
          type="button"
          disabled={saving !== null}
          onClick={() => elegir(true)}
          className="w-full text-left border border-slate-200 rounded px-4 py-3 hover:border-red-600 hover:bg-red-50/30 transition-colors disabled:opacity-50"
        >
          <div className="text-slate-900 font-semibold text-sm">
            {saving === true ? 'Creando borrador...' : 'Versión nueva'}
          </div>
          <div className="text-slate-400 text-xs font-mono mt-0.5">→ {mayorPreview}</div>
        </button>
      </div>
    </Modal>
  )
}

export default function TrainingModules() {
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState({ type: 'modules' })

  // Modal de creación (metadata: nombre/descripcion/vigencia). Un módulo ya
  // creado no permite editar estos campos — solo se definen al crearlo.
  const [moduleModal, setModuleModal] = useState(null)
  const [moduleForm, setModuleForm] = useState(EMPTY_MODULE_FORM)
  const [modulePreguntaIds, setModulePreguntaIds] = useState(new Set())
  const [saving, setSaving] = useState(false)

  // Modal de solo lectura "Ver detalles" de un módulo existente.
  const [detalleModal, setDetalleModal] = useState(null)

  // Confirmación de Activar/Desactivar el módulo entero (baja lógica, separada
  // de la edición de metadata).
  const [desactivarModal, setDesactivarModal] = useState(null)
  const [desactivando, setDesactivando] = useState(false)
  const [desactivarError, setDesactivarError] = useState(null)

  // Chips de filtro por estado del módulo (activo/borrador/inactivo), combinables.
  const [showActivos, setShowActivos] = useState(true)
  const [showBorradores, setShowBorradores] = useState(true)
  const [showInactivos, setShowInactivos] = useState(false)

  // Elección menor/mayor antes de crear el borrador (sólo cuando ya hay un ACTIVO).
  const [choiceModal, setChoiceModal] = useState(null)

  // Confirmación de Activar (publica el borrador de la vista actual).
  const [activarModal, setActivarModal] = useState(null)
  const [activando, setActivando] = useState(false)
  const [activarError, setActivarError] = useState(null)

  // Historial de versiones de un módulo.
  const [versiones, setVersiones] = useState([])
  const [versionesLoading, setVersionesLoading] = useState(false)
  const [versionesError, setVersionesError] = useState(null)

  // Toggle Activar/Desactivar de una pregunta dentro del borrador que se edita.
  const [togglingId, setTogglingId] = useState(null)
  const [toggleError, setToggleError] = useState(null)

  // Cambiar la elección menor/mayor de un borrador ya creado (recomendación).
  const [cambiandoLinea, setCambiandoLinea] = useState(false)

  // Banco de preguntas de la versión abierta en la vista "questions": la vigente
  // por default, o una versión puntual (el borrador, o una del historial) si
  // view.versionId la especifica. El hook se llama incondicionalmente; con
  // moduleId undefined queda inerte.
  const questionsView = view.type === 'questions' ? view : null
  const questionsModule = questionsView ? modules.find((m) => m.id === questionsView.moduleId) : null
  const banco = useBancoModulo(questionsView?.moduleId, questionsView?.versionId)

  // Base de la que partió el borrador (el ACTIVO al momento de crearlo), sólo
  // para comparar cuántas preguntas cambiaron y recomendar "versión nueva" si
  // son muchas. Inerte (no pide nada) salvo estando en un borrador editable
  // con un ACTIVO publicado del cual partir.
  const quiereCompararBase = !!questionsView && !questionsView.readOnly && questionsModule?.vigente?.estado === 'ACTIVO'
  const baseBanco = useBancoModulo(
    quiereCompararBase ? questionsView.moduleId : undefined,
    quiereCompararBase ? questionsModule.vigente.id : undefined,
  )

  const versionsView = view.type === 'versions' ? view : null
  const versionsModule = versionsView ? modules.find((m) => m.id === versionsView.moduleId) : null

  useEffect(() => {
    if (!versionsView) return
    modulosApi
      .versiones(versionsView.moduleId)
      .then((data) => {
        setVersiones(data)
        setVersionesError(null)
      })
      .catch((err) => setVersionesError(err.message))
      .finally(() => setVersionesLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionsView?.moduleId])

  const loadModules = () => {
    return modulosApi
      .list()
      .then((data) => {
        setModules(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadModules()
  }, [])

  // No permite apagar un chip si es el único encendido (evita "los tres off" =
  // "no mostrar nada" sin que el usuario lo haya elegido explícitamente).
  const toggleActivos = () => {
    if (showActivos && !showBorradores && !showInactivos) return
    setShowActivos((v) => !v)
  }
  const toggleBorradores = () => {
    if (showBorradores && !showActivos && !showInactivos) return
    setShowBorradores((v) => !v)
  }
  const toggleInactivos = () => {
    if (showInactivos && !showActivos && !showBorradores) return
    setShowInactivos((v) => !v)
  }

  const modulosFiltrados = modules.filter((mod) => {
    const estado = estadoModulo(mod)
    if (estado === 'activo') return showActivos
    if (estado === 'borrador') return showBorradores
    return showInactivos
  })

  // --- Module CRUD (metadata, solo al crear) ---
  const openCreateModule = () => {
    setModuleForm(EMPTY_MODULE_FORM)
    setModulePreguntaIds(new Set())
    setModuleModal({ mode: 'create' })
  }

  const toggleModulePregunta = (id) => {
    setModulePreguntaIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openDetalleModulo = (mod) => {
    setDetalleModal(mod)
  }

  const handleSaveModule = async () => {
    if (!moduleForm.nombre.trim()) return
    setSaving(true)
    setError(null)
    try {
      const vigenciaMeses = moduleForm.vigenciaMeses.trim() ? Number(moduleForm.vigenciaMeses) : undefined
      const payload = {
        nombre: moduleForm.nombre.trim(),
        descripcion: moduleForm.descripcion.trim() || undefined,
        vigenciaMeses,
      }
      const modulo = await modulosApi.create(payload)
      if (modulePreguntaIds.size > 0) {
        const items = [...modulePreguntaIds].map((preguntaId) => ({ preguntaId, obligatoria: true }))
        await modulosApi.asignarPreguntas(modulo.id, items)
      }
      loadModules()
      setModuleModal(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // --- Activar/desactivar el módulo entero (baja lógica) ---
  const handleToggleActivo = async () => {
    setDesactivando(true)
    setDesactivarError(null)
    try {
      await modulosApi.update(desactivarModal.id, { activo: desactivarModal.activo === false })
      await loadModules()
      setDesactivarModal(null)
    } catch (err) {
      setDesactivarError(err.message)
    } finally {
      setDesactivando(false)
    }
  }

  // --- Navegación a la vista de contenido ---
  const verVigente = (mod) => {
    setView({ type: 'questions', moduleId: mod.id, versionId: mod.vigente?.id, readOnly: true })
  }

  const continuarBorrador = (mod) => {
    setView({ type: 'questions', moduleId: mod.id, versionId: mod.borradorId, readOnly: false })
  }

  const editarSinPublicar = (mod) => {
    // Módulo nunca publicado: el vigente ES el borrador, se edita directo.
    setView({ type: 'questions', moduleId: mod.id, versionId: mod.vigente.id, readOnly: false })
  }

  const handleBorradorCreado = (mod, borradorId) => {
    setChoiceModal(null)
    loadModules()
    setView({ type: 'questions', moduleId: mod.id, versionId: borradorId, readOnly: false })
  }

  const verHistorial = (mod) => {
    setVersiones([])
    setVersionesError(null)
    setVersionesLoading(true)
    setView({ type: 'versions', moduleId: mod.id })
  }

  const verVersionDetalle = (mod, versionId) => {
    setView({ type: 'questions', moduleId: mod.id, versionId, readOnly: true, from: 'versions' })
  }

  // --- Activar/desactivar una pregunta dentro del borrador en edición ---
  const handleTogglePregunta = async (mvp) => {
    setTogglingId(mvp.preguntaId)
    setToggleError(null)
    try {
      await modulosApi.setPreguntaActiva(questionsView.moduleId, mvp.preguntaId, !mvp.activa)
      await banco.refresh()
    } catch (err) {
      setToggleError(err.message)
    } finally {
      setTogglingId(null)
    }
  }

  // --- Aceptar la recomendación de pasar a "versión nueva" ---
  const handleCambiarALinea = async () => {
    setCambiandoLinea(true)
    try {
      await modulosApi.actualizarEleccionBorrador(questionsView.moduleId, true)
      await banco.refresh()
    } catch (err) {
      setToggleError(err.message)
    } finally {
      setCambiandoLinea(false)
    }
  }

  // --- Activar (publicar) el borrador de la vista actual ---
  const handleActivar = async () => {
    setActivando(true)
    setActivarError(null)
    try {
      await modulosApi.activar(questionsView.moduleId)
      await loadModules()
      setActivarModal(null)
      setView({ type: 'modules' })
    } catch (err) {
      setActivarError(err.message)
    } finally {
      setActivando(false)
    }
  }

  // --- Vista: contenido de una versión (borrador editable o vigente read-only) ---
  if (view.type === 'questions') {
    const activarPreview = banco.version
      ? formatVersionNumero(previewActivacion(questionsModule?.vigente ?? null, banco.version.esNuevaLinea))
      : null

    const cambios = quiereCompararBase ? contarCambios(baseBanco.asignadas, banco.asignadas) : null
    const recomendarVersionNueva =
      quiereCompararBase && banco.version?.esNuevaLinea === false && cambios && deberiaRecomendarVersionNueva(cambios)

    return (
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView(
                view.from === 'versions'
                  ? { type: 'versions', moduleId: view.moduleId }
                  : { type: 'modules' },
              )}
            >
              ← Volver
            </Button>
            <div className="w-px h-5 bg-slate-200" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-slate-900 font-semibold text-sm">{questionsModule?.nombre}</span>
                {banco.version && estadoVersionBadge(banco.version.estado)}
                <span className="text-slate-400 text-xs font-mono">{formatVersionNumero(banco.version)}</span>
              </div>
              <div className="text-slate-400 text-[10px] font-mono">{banco.asignadas.length} preguntas</div>
            </div>
          </div>
          {!view.readOnly && (
            <div className="flex items-center gap-2">
              <BancoAcciones
                backendId={view.moduleId}
                assignedIds={banco.assignedIds}
                baseOrden={banco.baseOrden}
                onChanged={banco.refresh}
              />
              <Button onClick={() => setActivarModal({ preview: activarPreview })}>Activar</Button>
            </div>
          )}
        </div>

        {view.readOnly && (
          <div className="bg-slate-50 border border-slate-200 text-slate-500 text-xs rounded px-3 py-2">
            {banco.version?.estado === 'ARCHIVADO'
              ? 'Estás viendo una versión archivada del historial (solo lectura).'
              : 'Estás viendo la versión publicada (solo lectura). Para modificarla, volvé y usá "Editar contenido".'}
          </div>
        )}

        {recomendarVersionNueva && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
            <span>
              Hiciste {cambios.total} cambio{cambios.total !== 1 ? 's' : ''} de preguntas respecto a la versión publicada
              ({formatVersionNumero(questionsModule?.vigente)}). Con tantos cambios, capaz conviene activar esto como
              <strong> versión nueva</strong> en vez de actualización, así no termina siendo un módulo distinto sin que quede reflejado.
            </span>
            <Button variant="secondary" size="sm" onClick={handleCambiarALinea} disabled={cambiandoLinea}>
              {cambiandoLinea ? 'Cambiando...' : 'Cambiar a versión nueva'}
            </Button>
          </div>
        )}

        {toggleError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{toggleError}</div>}

        <PreguntasAsignadasPanel
          asignadas={banco.asignadas}
          error={banco.error}
          onToggle={view.readOnly ? undefined : handleTogglePregunta}
          togglingId={togglingId}
        />

        <Modal
          open={!!activarModal}
          onClose={() => setActivarModal(null)}
          title="Activar versión"
          footer={
            <>
              <Button variant="secondary" onClick={() => setActivarModal(null)}>Cancelar</Button>
              <Button onClick={handleActivar} disabled={activando}>{activando ? 'Activando...' : 'Activar'}</Button>
            </>
          }
        >
          <div className="space-y-3">
            {activarError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{activarError}</div>}
            <p className="text-slate-600 text-sm">
              Se va a publicar esta versión como <span className="font-mono font-semibold">{activarModal?.preview}</span>.
              {questionsModule?.vigente?.estado === 'ACTIVO' && ' La versión publicada actual pasará a archivada.'}
            </p>
          </div>
        </Modal>
      </div>
    )
  }

  // --- Vista: Historial de versiones de un módulo ---
  if (view.type === 'versions') {
    const versionColumns = [
      { key: 'numero', label: 'Versión', render: (_, row) => <span className="font-mono text-slate-700">{formatVersionNumero(row)}</span> },
      { key: 'estado', label: 'Estado', render: (estado) => estadoVersionBadge(estado) },
      { key: 'preguntasCount', label: 'Preguntas' },
      {
        key: 'activadaEn',
        label: 'Publicada el',
        render: (activadaEn) => (
          <span className="text-slate-500 text-xs font-mono">
            {activadaEn ? new Date(activadaEn).toLocaleDateString('es-AR') : '—'}
          </span>
        ),
      },
    ]

    // Más reciente primero.
    const rows = [...versiones].sort((a, b) => b.numeroVersion - a.numeroVersion)

    return (
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView({ type: 'modules' })}>← Volver</Button>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <div className="text-slate-900 font-semibold text-sm">{versionsModule?.nombre}</div>
            <div className="text-slate-400 text-[10px] font-mono">{versiones.length} versión{versiones.length !== 1 ? 'es' : ''}</div>
          </div>
        </div>

        {versionesError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{versionesError}</div>}
        {versionesLoading && <div className="text-slate-400 text-xs font-mono">Cargando...</div>}

        <Table
          columns={versionColumns}
          data={rows}
          actions={(row) => (
            <Button variant="ghost" size="sm" onClick={() => verVersionDetalle(versionsModule, row.id)}>Ver</Button>
          )}
        />
      </div>
    )
  }

  // --- Vista: Tabla de módulos ---
  const moduleColumns = [
    { key: 'nombre', label: 'Nombre' },
    {
      key: 'vigente',
      label: 'Estado',
      render: (vigente, row) => (
        <div className="flex items-center gap-2">
          {row.activo === false && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">Inactivo</span>
          )}
          {estadoVersionBadge(vigente?.estado)}
          <span className="text-slate-400 text-xs font-mono">{formatVersionNumero(vigente)}</span>
        </div>
      ),
    },
    {
      key: 'vigenciaMeses',
      label: 'Vigencia',
      render: (vigenciaMeses) => (
        <span className="text-slate-500 text-xs font-mono">
          {vigenciaMeses != null ? `Cada ${vigenciaMeses} mes${vigenciaMeses !== 1 ? 'es' : ''}` : '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Módulos</h2>
          <p className="text-slate-400 text-sm">{modulosFiltrados.length} módulos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreateModule}>+ Nuevo módulo</Button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>}
      {loading && <div className="text-slate-400 text-xs font-mono">Cargando...</div>}

      <div className="flex items-center gap-2 flex-wrap">
        <ChipToggle active={showActivos} onClick={toggleActivos}>Activos</ChipToggle>
        <ChipToggle active={showBorradores} onClick={toggleBorradores}>Borradores</ChipToggle>
        <ChipToggle active={showInactivos} onClick={toggleInactivos}>Inactivos</ChipToggle>
      </div>

      <Table
        columns={moduleColumns}
        data={modulosFiltrados}
        actions={(row) => {
          const nuncaPublicado = row.vigente?.estado === 'BORRADOR'
          return (
            <>
              {nuncaPublicado ? (
                <Button variant="ghost" size="sm" onClick={() => editarSinPublicar(row)}>Editar contenido</Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => verVigente(row)}>Ver preguntas</Button>
                  {row.borradorId ? (
                    <Button variant="ghost" size="sm" onClick={() => continuarBorrador(row)}>Continuar borrador</Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setChoiceModal(row)}>Editar contenido</Button>
                  )}
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => verHistorial(row)}>Historial</Button>
              <Button variant="ghost" size="sm" onClick={() => openDetalleModulo(row)}>Ver detalles</Button>
              <Button
                variant={row.activo === false ? 'ghost' : 'danger'}
                size="sm"
                onClick={() => setDesactivarModal(row)}
              >
                {row.activo === false ? 'Activar' : 'Desactivar'}
              </Button>
            </>
          )
        }}
      />

      <Modal
        open={!!moduleModal}
        onClose={() => setModuleModal(null)}
        title="Nuevo módulo"
        size="lg"
        footer={
          <>
            <span className="text-slate-500 text-xs font-mono mr-auto">
              {modulePreguntaIds.size} pregunta{modulePreguntaIds.size !== 1 ? 's' : ''} seleccionada{modulePreguntaIds.size !== 1 ? 's' : ''}
            </span>
            <Button variant="secondary" onClick={() => setModuleModal(null)}>Cancelar</Button>
            <Button onClick={handleSaveModule} disabled={saving}>
              {saving ? 'Guardando...' : modulePreguntaIds.size > 0 ? 'Crear y asignar' : 'Crear'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">Nombre</label>
            <input
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
              value={moduleForm.nombre}
              onChange={(e) => setModuleForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre del módulo"
            />
          </div>
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">
              Descripción <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              rows={3}
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm resize-none focus:outline-none focus:border-red-600"
              value={moduleForm.descripcion}
              onChange={(e) => setModuleForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Descripción del módulo"
            />
          </div>
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">
              Vigencia (meses) <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="number"
              min="1"
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
              value={moduleForm.vigenciaMeses}
              onChange={(e) => setModuleForm((f) => ({ ...f, vigenciaMeses: e.target.value }))}
              placeholder="Cada cuántos meses debe recertificarse un alumno"
            />
          </div>
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">
              Preguntas <span className="text-slate-400 font-normal">(opcional — el módulo queda como borrador igual)</span>
            </label>
            <PreguntaBancoPicker selectedIds={modulePreguntaIds} onToggle={toggleModulePregunta} />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!detalleModal}
        onClose={() => setDetalleModal(null)}
        title="Detalles del módulo"
        footer={<Button variant="secondary" onClick={() => setDetalleModal(null)}>Cerrar</Button>}
      >
        {detalleModal && (
          <div className="space-y-4">
            <div>
              <div className="text-slate-400 text-xs font-medium mb-1">Nombre</div>
              <div className="text-slate-900 text-sm">{detalleModal.nombre}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs font-medium mb-1">Descripción</div>
              <div className="text-slate-900 text-sm whitespace-pre-wrap">{detalleModal.descripcion || '—'}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs font-medium mb-1">Vigencia</div>
              <div className="text-slate-900 text-sm font-mono">
                {detalleModal.vigenciaMeses != null
                  ? `Cada ${detalleModal.vigenciaMeses} mes${detalleModal.vigenciaMeses !== 1 ? 'es' : ''}`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-xs font-medium mb-1">Estado</div>
              <div className="text-slate-900 text-sm">{detalleModal.activo === false ? 'Inactivo' : 'Activo'}</div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!desactivarModal}
        onClose={() => setDesactivarModal(null)}
        title={desactivarModal?.activo === false ? 'Activar módulo' : 'Desactivar módulo'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDesactivarModal(null)}>Cancelar</Button>
            <Button
              variant={desactivarModal?.activo === false ? 'primary' : 'danger'}
              onClick={handleToggleActivo}
              disabled={desactivando}
            >
              {desactivando
                ? 'Guardando...'
                : desactivarModal?.activo === false
                  ? 'Activar'
                  : 'Desactivar'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {desactivarError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{desactivarError}</div>
          )}
          {desactivarModal?.activo === false ? (
            <p className="text-slate-600 text-sm">
              Vas a reactivar el módulo <span className="font-semibold">{desactivarModal?.nombre}</span>. Vuelve a estar
              disponible para los usuarios que lo tengan asignado.
            </p>
          ) : (
            <p className="text-slate-600 text-sm">
              Vas a desactivar el módulo <span className="font-semibold">{desactivarModal?.nombre}</span>. Los usuarios
              que lo tengan asignado van a dejar de verlo, pero el módulo <strong>no se elimina</strong> y podés
              reactivarlo cuando quieras.
            </p>
          )}
        </div>
      </Modal>

      {choiceModal && (
        <VersionChoiceModal
          mod={choiceModal}
          onClose={() => setChoiceModal(null)}
          onCreated={(borradorId) => handleBorradorCreado(choiceModal, borradorId)}
        />
      )}
    </div>
  )
}
