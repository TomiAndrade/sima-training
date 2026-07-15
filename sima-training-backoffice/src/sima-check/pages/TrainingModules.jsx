import { useEffect, useRef, useState } from 'react'
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

  // Confirmación de cancelar el borrador en curso (descarta cambios sin
  // publicar; si el módulo nunca se publicó, elimina el módulo entero).
  const [cancelarBorradorModal, setCancelarBorradorModal] = useState(null)
  const [cancelandoBorrador, setCancelandoBorrador] = useState(false)
  const [cancelarBorradorError, setCancelarBorradorError] = useState(null)

  // Confirmación al salir del borrador con "← Volver": guardar (aplica los
  // cambios pendientes de esta sesión) o descartarlos.
  const [volverModal, setVolverModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardarError, setGuardarError] = useState(null)

  // Chips de filtro por estado del módulo (activo/borrador/inactivo), combinables.
  const [showActivos, setShowActivos] = useState(true)
  const [showBorradores, setShowBorradores] = useState(true)
  const [showInactivos, setShowInactivos] = useState(false)

  // Creación de un borrador nuevo a partir del ACTIVO (sin preguntar actualización/
  // versión nueva: esa elección se pospone al Activar). Loading por módulo.
  const [creandoBorradorId, setCreandoBorradorId] = useState(null)

  // Confirmación de Activar (publica el borrador de la vista actual). Si el
  // módulo ya tiene un ACTIVO hay que elegir actualización/versión nueva acá.
  const [activarModal, setActivarModal] = useState(false)
  const [esNuevaLineaElegida, setEsNuevaLineaElegida] = useState(false)
  const [activando, setActivando] = useState(false)
  const [activarError, setActivarError] = useState(null)

  // Historial de versiones de un módulo.
  const [versiones, setVersiones] = useState([])
  const [versionesLoading, setVersionesLoading] = useState(false)
  const [versionesError, setVersionesError] = useState(null)

  // Banco de preguntas de la versión abierta en la vista "questions": la vigente
  // por default, o una versión puntual (el borrador, o una del historial) si
  // view.versionId la especifica. El hook se llama incondicionalmente; con
  // moduleId undefined queda inerte.
  const questionsView = view.type === 'questions' ? view : null
  const questionsModule = questionsView ? modules.find((m) => m.id === questionsView.moduleId) : null
  const banco = useBancoModulo(questionsView?.moduleId, questionsView?.versionId)

  // Staging: mientras se edita un borrador, los cambios (asignar/quitar/
  // activar-desactivar) viven acá y no pegan al backend hasta "Guardar y
  // volver" o "Activar" (ver flushCambios). `localAsignadas` arranca como
  // foto de `banco.asignadas` una sola vez por sesión de edición — la
  // sessionKeyRef evita re-tomar la foto en cada render, solo cuando se entra
  // a un borrador distinto (otro moduleId/versionId).
  const [localAsignadas, setLocalAsignadas] = useState([])
  const sessionKeyRef = useRef(null)
  useEffect(() => {
    if (!questionsView || questionsView.readOnly || !banco.version) return
    const key = `${questionsView.moduleId}:${questionsView.versionId}`
    if (sessionKeyRef.current !== key) {
      sessionKeyRef.current = key
      setLocalAsignadas(banco.asignadas)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionsView?.moduleId, questionsView?.versionId, questionsView?.readOnly, banco.version])

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

  // --- Cancelar el borrador en curso (descartar sin publicar) ---
  const handleCancelarBorrador = async () => {
    setCancelandoBorrador(true)
    setCancelarBorradorError(null)
    try {
      await modulosApi.cancelarBorrador(cancelarBorradorModal.id)
      await loadModules()
      setCancelarBorradorModal(null)
      if (view.type === 'questions' && view.moduleId === cancelarBorradorModal.id) {
        setView({ type: 'modules' })
      }
    } catch (err) {
      setCancelarBorradorError(err.message)
    } finally {
      setCancelandoBorrador(false)
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

  // Módulo publicado sin borrador en curso: crea el borrador (copia las
  // preguntas del ACTIVO) y entra directo a editarlo. La elección
  // actualización/versión nueva se pospone al Activar, acá no se pregunta nada.
  const crearBorradorYEditar = async (mod) => {
    setCreandoBorradorId(mod.id)
    setError(null)
    try {
      const borrador = await modulosApi.crearVersion(mod.id)
      await loadModules()
      setView({ type: 'questions', moduleId: mod.id, versionId: borrador.id, readOnly: false })
    } catch (err) {
      setError(err.message)
    } finally {
      setCreandoBorradorId(null)
    }
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

  // --- Acciones locales sobre el borrador en edición (staged, sin red) ---
  const handleTogglePreguntaLocal = (mvp) => {
    setLocalAsignadas((prev) => prev.map((m) => (m.preguntaId === mvp.preguntaId ? { ...m, activa: !m.activa } : m)))
  }

  const handleQuitarPreguntaLocal = (mvp) => {
    setLocalAsignadas((prev) => prev.filter((m) => m.preguntaId !== mvp.preguntaId))
  }

  // items: [{ preguntaId, orden, obligatoria, pregunta }] (AsignarPreguntaModal, modo staged)
  const handleAsignarLocal = (items) => {
    setLocalAsignadas((prev) => [
      ...prev,
      ...items.map((item) => ({
        preguntaId: item.preguntaId,
        orden: item.orden,
        obligatoria: item.obligatoria,
        activa: true,
        pregunta: item.pregunta,
      })),
    ])
  }

  // NuevaPreguntaModal (modo staged): una pregunta recién creada en el banco.
  const handleNuevaPreguntaLocal = (pregunta) => {
    setLocalAsignadas((prev) => [
      ...prev,
      {
        preguntaId: pregunta.id,
        orden: prev.reduce((max, m) => Math.max(max, m.orden), 0) + 1,
        obligatoria: true,
        activa: true,
        pregunta,
      },
    ])
  }

  // Aplica al backend la diferencia entre lo que había al entrar a esta sesión
  // (banco.asignadas, nunca se refresca mientras se edita) y lo que quedó
  // armado localmente — la mínima cantidad de llamadas para llegar al estado
  // deseado. La usan "Guardar y volver" y "Activar".
  const flushCambios = async () => {
    const moduloId = questionsView.moduleId
    const antes = new Map(banco.asignadas.map((m) => [m.preguntaId, m]))
    const ahora = new Map(localAsignadas.map((m) => [m.preguntaId, m]))

    for (const id of antes.keys()) {
      if (!ahora.has(id)) await modulosApi.unassignPregunta(moduloId, id)
    }
    for (const [id, m] of ahora) {
      if (!antes.has(id)) {
        await modulosApi.asignarPreguntas(moduloId, [{ preguntaId: id, orden: m.orden, obligatoria: m.obligatoria }])
        if (!m.activa) await modulosApi.setPreguntaActiva(moduloId, id, false)
      }
    }
    for (const [id, m] of ahora) {
      const previo = antes.get(id)
      if (previo && previo.activa !== m.activa) {
        await modulosApi.setPreguntaActiva(moduloId, id, m.activa)
      }
    }
  }

  // --- Guardar los cambios pendientes y volver a la lista ---
  const handleGuardarYVolver = async (irAtras) => {
    setGuardando(true)
    setGuardarError(null)
    try {
      await flushCambios()
      await loadModules()
      setVolverModal(false)
      irAtras()
    } catch (err) {
      setGuardarError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  // --- Activar (publicar) el borrador de la vista actual ---
  const handleActivar = async () => {
    setActivando(true)
    setActivarError(null)
    try {
      const hayActivo = questionsModule?.vigente?.estado === 'ACTIVO'
      await flushCambios()
      await modulosApi.activar(questionsView.moduleId, hayActivo ? esNuevaLineaElegida : undefined)
      await loadModules()
      setActivarModal(false)
      setView({ type: 'modules' })
    } catch (err) {
      setActivarError(err.message)
    } finally {
      setActivando(false)
    }
  }

  // --- Vista: contenido de una versión (borrador editable o vigente read-only) ---
  if (view.type === 'questions') {
    // Hay que elegir actualización/versión nueva recién al Activar, solo si el
    // módulo ya tiene un ACTIVO publicado del cual derivar el número.
    const hayActivo = questionsModule?.vigente?.estado === 'ACTIVO'
    // Comparado contra lo armado en esta sesión (localAsignadas), no contra el
    // servidor: refleja lo que se va a publicar si se activa ahora mismo.
    const cambios = quiereCompararBase ? contarCambios(baseBanco.asignadas, localAsignadas) : null
    const recomendarVersionNueva = quiereCompararBase && cambios && deberiaRecomendarVersionNueva(cambios)
    const asignadasVista = view.readOnly ? banco.asignadas : localAsignadas

    const irAtras = () => setView(
      view.from === 'versions'
        ? { type: 'versions', moduleId: view.moduleId }
        : { type: 'modules' },
    )

    return (
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (view.readOnly ? irAtras() : setVolverModal(true))}
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
              <div className="text-slate-400 text-[10px] font-mono">{asignadasVista.length} preguntas</div>
            </div>
          </div>
          {!view.readOnly && (
            <div className="flex items-center gap-2">
              <BancoAcciones
                backendId={view.moduleId}
                assignedIds={new Set(localAsignadas.map((m) => m.preguntaId))}
                baseOrden={localAsignadas.length}
                onAssignExisting={handleAsignarLocal}
                onAssignNew={handleNuevaPreguntaLocal}
              />
              <Button variant="danger" onClick={() => setCancelarBorradorModal(questionsModule)}>
                {questionsModule?.vigente?.estado === 'BORRADOR' ? 'Eliminar módulo' : 'Cancelar borrador'}
              </Button>
              <Button onClick={() => { setEsNuevaLineaElegida(false); setActivarError(null); setActivarModal(true) }}>Activar</Button>
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

        <PreguntasAsignadasPanel
          asignadas={asignadasVista}
          error={banco.error}
          onToggle={view.readOnly ? undefined : handleTogglePreguntaLocal}
          onRemove={view.readOnly ? undefined : handleQuitarPreguntaLocal}
        />

        <Modal
          open={!!activarModal}
          onClose={() => setActivarModal(false)}
          title="Activar versión"
          footer={
            <>
              <Button variant="secondary" onClick={() => setActivarModal(false)}>Cancelar</Button>
              <Button onClick={handleActivar} disabled={activando}>{activando ? 'Activando...' : 'Activar'}</Button>
            </>
          }
        >
          <div className="space-y-3">
            {activarError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{activarError}</div>}
            {hayActivo ? (
              <>
                <p className="text-slate-500 text-sm">
                  El módulo ya tiene una versión publicada ({formatVersionNumero(questionsModule.vigente)}). ¿Cómo querés publicar estos cambios?
                </p>
                <button
                  type="button"
                  onClick={() => setEsNuevaLineaElegida(false)}
                  className={`w-full text-left border rounded px-4 py-3 transition-colors ${
                    !esNuevaLineaElegida ? 'border-red-600 bg-red-50/30' : 'border-slate-200 hover:border-red-600'
                  }`}
                >
                  <div className="text-slate-900 font-semibold text-sm">Actualización (misma versión)</div>
                  <div className="text-slate-400 text-xs font-mono mt-0.5">
                    → {formatVersionNumero(previewActivacion(questionsModule.vigente, false))}
                  </div>
                </button>
                {recomendarVersionNueva && !esNuevaLineaElegida && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded px-3 py-2">
                    Hiciste {cambios.total} cambio{cambios.total !== 1 ? 's' : ''} de preguntas respecto a la versión
                    publicada. Con tantos cambios, capaz conviene activar esto como <strong>versión nueva</strong> en vez
                    de actualización, así no termina siendo un módulo distinto sin que quede reflejado.
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setEsNuevaLineaElegida(true)}
                  className={`w-full text-left border rounded px-4 py-3 transition-colors ${
                    esNuevaLineaElegida ? 'border-red-600 bg-red-50/30' : 'border-slate-200 hover:border-red-600'
                  }`}
                >
                  <div className="text-slate-900 font-semibold text-sm">Versión nueva</div>
                  <div className="text-slate-400 text-xs font-mono mt-0.5">
                    → {formatVersionNumero(previewActivacion(questionsModule.vigente, true))}
                  </div>
                </button>
                <p className="text-slate-400 text-xs">La versión publicada actual pasará a archivada.</p>
              </>
            ) : (
              <p className="text-slate-600 text-sm">
                Se va a publicar esta versión como{' '}
                <span className="font-mono font-semibold">{formatVersionNumero(previewActivacion(null, true))}</span>.
              </p>
            )}
          </div>
        </Modal>

        <Modal
          open={volverModal}
          onClose={() => setVolverModal(false)}
          title="Salir del borrador"
          footer={
            <>
              <Button variant="secondary" onClick={() => setVolverModal(false)} disabled={guardando}>Seguir editando</Button>
              <Button
                variant="danger"
                disabled={guardando}
                onClick={() => {
                  setVolverModal(false)
                  if (hayActivo) {
                    // Nada se mandó al servidor durante la sesión: descartar es
                    // solo tirar el estado local y volver, sin llamar al backend.
                    irAtras()
                  } else {
                    // Nunca se publicó: no hay ACTIVO al cual volver, así que
                    // descartar es eliminar el módulo entero (mismo flujo que
                    // el botón "Eliminar módulo" de más abajo).
                    setCancelarBorradorModal(questionsModule)
                  }
                }}
              >
                {hayActivo ? 'Descartar cambios' : 'Eliminar módulo'}
              </Button>
              <Button onClick={() => handleGuardarYVolver(irAtras)} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar y volver'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {guardarError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{guardarError}</div>}
            <p className="text-slate-600 text-sm">
              Los cambios que hiciste en esta sesión todavía no se guardaron. Podés guardarlos y volver, o descartarlos
              {hayActivo ? ' (el borrador queda como estaba antes de esta sesión).' : ' — como el módulo nunca se publicó, se elimina entero.'}
            </p>
          </div>
        </Modal>

        <Modal
          open={!!cancelarBorradorModal}
          onClose={() => setCancelarBorradorModal(null)}
          title={cancelarBorradorModal?.vigente?.estado === 'BORRADOR' ? 'Eliminar módulo' : 'Cancelar borrador'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCancelarBorradorModal(null)}>Volver</Button>
              <Button variant="danger" onClick={handleCancelarBorrador} disabled={cancelandoBorrador}>
                {cancelandoBorrador
                  ? 'Guardando...'
                  : cancelarBorradorModal?.vigente?.estado === 'BORRADOR'
                    ? 'Eliminar módulo'
                    : 'Cancelar borrador'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {cancelarBorradorError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{cancelarBorradorError}</div>
            )}
            {cancelarBorradorModal?.vigente?.estado === 'BORRADOR' ? (
              <p className="text-slate-600 text-sm">
                El módulo <span className="font-semibold">{cancelarBorradorModal?.nombre}</span> nunca se publicó — es
                solo este borrador. Eliminarlo <strong>borra el módulo entero</strong> y no se puede deshacer.
              </p>
            ) : (
              <p className="text-slate-600 text-sm">
                Vas a descartar el borrador en curso de <span className="font-semibold">{cancelarBorradorModal?.nombre}</span>.
                Se pierden los cambios sin publicar y el módulo vuelve a mostrar la última versión activa. Esta acción no
                se puede deshacer.
              </p>
            )}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={creandoBorradorId === row.id}
                      onClick={() => crearBorradorYEditar(row)}
                    >
                      {creandoBorradorId === row.id ? 'Creando borrador...' : 'Editar contenido'}
                    </Button>
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
    </div>
  )
}
