import { useEffect, useRef, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { modulosApi } from '../../core/api/modulos'
import { useBancoModulo, estadoVersionBadge, estadoModulo, claveCriterio } from '../components/bancoModulo'
import { formatVersionNumero } from '../../core/format/version'
import { BancoAcciones, PreguntasAsignadasPanel, PreguntaBancoPicker } from '../components/BancoPreguntas'
import CriteriosPanel from '../components/CriteriosPanel'
import ParametrosExamenPanel from '../components/ParametrosExamenPanel'
import {
  PARAMETROS_VACIOS,
  parametrosAPayload,
  parametrosDesdeVersion,
  parametrosDistintos,
} from '../components/parametrosExamen'

const EMPTY_MODULE_FORM = {
  nombre: '',
  descripcion: '',
  vigenciaMeses: '',
  // Arranca en false igual que el default de la columna: exponer un módulo a
  // gente de afuera de la empresa tiene que ser un acto explícito.
  demoPublico: false,
}

// Foto vacía de "Detalles del módulo" (nombre/descripción/vigencia) en
// "Editar contenido" — ver el comentario junto a localDetalles.
const DETALLES_VACIOS = { nombre: '', descripcion: '', vigenciaMeses: '' }

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
  // Qué evalúa y cómo se rinde, elegidos ya en el alta. Los dos van a la v1
  // BORRADOR que nace con el módulo: los criterios por un PUT posterior (el
  // módulo tiene que existir primero) y los parámetros dentro del propio POST.
  const [moduleCriterios, setModuleCriterios] = useState([])
  const [moduleParametros, setModuleParametros] = useState(PARAMETROS_VACIOS)
  const [saving, setSaving] = useState(false)
  // El error del alta se pinta DENTRO del modal y no en el banner global de la
  // página: el modal tapa el banner, así que el mensaje quedaba invisible justo
  // cuando importa. Más ahora, que el submit son tres llamadas y puede fallar
  // cualquiera.
  const [moduleError, setModuleError] = useState(null)

  // Modal de solo lectura "Ver detalles" de un módulo existente.
  const [detalleModal, setDetalleModal] = useState(null)

  // Confirmación de Activar/Desactivar el módulo entero (baja lógica, separada
  // de la edición de metadata).
  const [desactivarModal, setDesactivarModal] = useState(null)
  // Estado propio del toggle de demo (dentro del modal de detalles), aparte del
  // de Desactivar: son dos acciones distintas sobre la misma fila y compartir el
  // flag dejaría los dos botones en "guardando" al tocar cualquiera.
  const [guardandoDemo, setGuardandoDemo] = useState(false)
  const [demoError, setDemoError] = useState(null)
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

  // Guardado de criterios: modelo distinto del staging de preguntas (pega al
  // backend al confirmar), con su propio modal para que esa diferencia se vea.
  const [criteriosModal, setCriteriosModal] = useState(false)
  const [guardandoCriterios, setGuardandoCriterios] = useState(false)
  const [criteriosError, setCriteriosError] = useState(null)
  const [criteriosResultado, setCriteriosResultado] = useState(null)

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
  // Los criterios NO son staged: tienen su propio botón "Guardar criterios" que
  // pega al backend al toque (ver handleGuardarCriterios). `localCriterios` es
  // sólo el estado del formulario mientras se editan las filas.
  const [localCriterios, setLocalCriterios] = useState([])
  // Mismo modelo que los criterios: no son staged, tienen su propio botón que
  // pega al backend (ver handleGuardarParametros). `localParametros` es el
  // formulario y `parametrosGuardados` la foto del servidor contra la que se
  // compara para habilitar el guardado.
  const [localParametros, setLocalParametros] = useState(PARAMETROS_VACIOS)
  const [parametrosGuardados, setParametrosGuardados] = useState(PARAMETROS_VACIOS)
  const [guardandoParametros, setGuardandoParametros] = useState(false)
  const [parametrosError, setParametrosError] = useState(null)
  // Detalles del módulo (nombre/descripción/vigencia): metadata del CONTENEDOR
  // y no de la versión, pero se edita acá igual que parámetros y criterios —
  // "Editar contenido" es donde se termina de configurar un módulo, y antes no
  // había ningún lugar del backoffice para tocar la vigencia después de crearlo.
  // Mismo modelo sin staging que parámetros: botón propio, pega directo al PATCH.
  const [localDetalles, setLocalDetalles] = useState(DETALLES_VACIOS)
  const [detallesGuardados, setDetallesGuardados] = useState(DETALLES_VACIOS)
  const [guardandoDetalles, setGuardandoDetalles] = useState(false)
  const [detallesError, setDetallesError] = useState(null)
  const sessionKeyRef = useRef(null)
  useEffect(() => {
    if (!questionsView || questionsView.readOnly || !banco.version) return
    const key = `${questionsView.moduleId}:${questionsView.versionId}`
    if (sessionKeyRef.current !== key) {
      sessionKeyRef.current = key
      setLocalAsignadas(banco.asignadas)
      setLocalCriterios(
        banco.criterios.map((c) => ({
          baseConocimientoId: c.baseConocimientoId,
          nivelId: c.nivelId,
        })),
      )
      const desdeServidor = parametrosDesdeVersion(banco.version)
      setLocalParametros(desdeServidor)
      setParametrosGuardados(desdeServidor)
      setParametrosError(null)
      const detallesDesdeServidor = {
        nombre: questionsModule?.nombre ?? '',
        descripcion: questionsModule?.descripcion ?? '',
        vigenciaMeses: questionsModule?.vigenciaMeses != null ? String(questionsModule.vigenciaMeses) : '',
      }
      setLocalDetalles(detallesDesdeServidor)
      setDetallesGuardados(detallesDesdeServidor)
      setDetallesError(null)
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
    setModuleCriterios([])
    setModuleParametros(PARAMETROS_VACIOS)
    setModuleError(null)
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
    // Un error del toggle de demo no puede sobrevivir a cerrar el modal y
    // reaparecer sobre otro módulo.
    setDemoError(null)
  }

  // Criterios listos para mandar: los completos (una fila recién agregada
  // arranca sin base elegida) y sin repetidos.
  const moduleCriteriosValidos = moduleCriterios.filter((c) => c.baseConocimientoId)
  const moduleCriteriosRepetidos =
    new Set(moduleCriteriosValidos.map(claveCriterio)).size !== moduleCriteriosValidos.length

  const handleSaveModule = async () => {
    if (!moduleForm.nombre.trim()) {
      setModuleError('Poné un nombre para el módulo.')
      return
    }
    if (moduleCriteriosRepetidos) {
      setModuleError('Hay criterios repetidos: la misma base con el mismo nivel aparece más de una vez.')
      return
    }
    setSaving(true)
    setModuleError(null)
    try {
      const vigenciaMeses = moduleForm.vigenciaMeses.trim() ? Number(moduleForm.vigenciaMeses) : undefined
      const payload = {
        nombre: moduleForm.nombre.trim(),
        descripcion: moduleForm.descripcion.trim() || undefined,
        vigenciaMeses,
        demoPublico: moduleForm.demoPublico,
        // Los parámetros de examen viajan en el propio POST: el backend los
        // desvía a la v1 BORRADOR que crea junto con el módulo.
        ...parametrosAPayload(moduleParametros),
      }
      const modulo = await modulosApi.create(payload)

      // El ORDEN de los dos pasos siguientes importa. Las preguntas elegidas a
      // mano van PRIMERO (quedan como pivots MANUAL) y los criterios después:
      // resolverCriterios() nunca toca las MANUAL, así que una pregunta que
      // además matchea un criterio no se duplica. Al revés, ya tendría pivot
      // CRITERIO y asignarPreguntas moriría con un 409 "ya está asignada".
      if (modulePreguntaIds.size > 0) {
        const items = [...modulePreguntaIds].map((preguntaId) => ({ preguntaId, obligatoria: true }))
        await modulosApi.asignarPreguntas(modulo.id, items)
      }
      if (moduleCriteriosValidos.length > 0) {
        await modulosApi.setCriterios(modulo.id, moduleCriteriosValidos)
      }

      loadModules()
      setModuleModal(null)
    } catch (err) {
      // El módulo puede haber quedado creado con alguno de los pasos siguientes
      // sin aplicar. No se borra solo: queda como BORRADOR y se termina de armar
      // desde "Editar contenido", que es exactamente para lo que existe esa vista.
      setModuleError(
        `${err.message} — si el módulo llegó a crearse, va a aparecer en la lista como borrador; terminá de configurarlo desde "Editar contenido".`,
      )
      loadModules()
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

  // --- Poner/sacar el módulo del modo demostración ---
  //
  // Vive en el modal de "Ver detalles" y no como una acción de fila: la fila ya
  // tiene cuatro botones y éste es el menos frecuente de todos (se toca una vez
  // por módulo, no en el día a día). El modal era de solo lectura hasta acá, y
  // se le hace esta excepción porque es donde ya está toda la metadata.
  //
  // Sin modal de confirmación propio, a diferencia de Desactivar: sacar un
  // módulo de la demo no afecta a ningún alumno ni revoca nada, y ponerlo se
  // deshace con el mismo botón. Lo que sí hace es refrescar la lista, para que
  // el badge "Demo" de la tabla no quede mintiendo.
  const handleToggleDemo = async () => {
    if (!detalleModal) return
    const proximo = !detalleModal.demoPublico
    setGuardandoDemo(true)
    setDemoError(null)
    try {
      await modulosApi.update(detalleModal.id, { demoPublico: proximo })
      // Se actualiza el modal abierto además de recargar la lista: si sólo se
      // recargara, el modal seguiría mostrando el valor viejo (tiene su propia
      // copia de la fila, no una referencia viva a la lista).
      setDetalleModal((m) => ({ ...m, demoPublico: proximo }))
      await loadModules()
    } catch (err) {
      setDemoError(err.message)
    } finally {
      setGuardandoDemo(false)
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

  // Cuántos cambios de preguntas hay sin mandar al backend en esta sesión. Se
  // usa para avisarlo en el modal de "Guardar criterios", que los va a guardar
  // de paso — que existan dos modelos de guardado es tolerable, que uno actúe
  // sin avisar no.
  const contarPendientes = () => {
    if (!questionsView || questionsView.readOnly) return 0
    const antes = new Map(banco.asignadas.map((m) => [m.preguntaId, m]))
    const ahora = new Map(localAsignadas.map((m) => [m.preguntaId, m]))
    let n = 0
    for (const id of antes.keys()) if (!ahora.has(id)) n += 1
    for (const [id, m] of ahora) {
      const previo = antes.get(id)
      if (!previo || previo.activa !== m.activa) n += 1
    }
    return n
  }

  // Aplica al backend la diferencia entre lo que había al entrar a esta sesión
  // (banco.asignadas, nunca se refresca mientras se edita) y lo que quedó
  // armado localmente — la mínima cantidad de llamadas para llegar al estado
  // deseado. La usan "Guardar y volver", "Activar" y "Guardar criterios".
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

  // --- Guardar los criterios (modelo de guardado propio, no staged) ---
  //
  // El PUT materializa pivots EN EL SERVIDOR, así que después de guardarlo las
  // dos fotos del staging quedan viejas: `banco.asignadas` (la base del diff) y
  // `localAsignadas` (lo que se está editando). Refrescar sólo `banco` sería
  // peor que no hacer nada — el flushCambios siguiente vería los pivots recién
  // materializados en `antes` pero no en `ahora` y los borraría. De ahí los tres
  // pasos, en este orden:
  //
  //   1. flushCambios(): manda lo pendiente de la sesión. Sin esto se perdería,
  //      porque el paso 3 pisa `localAsignadas` con lo que diga el servidor.
  //      El modal lo dice explícitamente cuando hay algo pendiente.
  //   2. el PUT de criterios.
  //   3. re-baseline: sessionKeyRef en null + refresh. El efecto de staging
  //      tiene `banco.version` en sus deps y el refresh setea un objeto nuevo,
  //      así que vuelve a correr, ve la key distinta y re-snapshotea las dos
  //      fotos desde el servidor. Quedan sincronizadas sin maquinaria nueva.
  //
  // El paso 3 va en `finally` y NO sólo en el camino feliz: si el paso 1 llegó a
  // aplicarse y el 2 falló (409 porque otra sesión publicó la versión, un corte
  // de red), el servidor ya tiene los cambios de preguntas y `banco.asignadas`
  // no — el flush siguiente intentaría des-asignar un pivot que ya no existe y
  // moriría con un 404. Resincronizar siempre cuesta que se pierdan las filas de
  // criterios que se estaban editando, y a cambio deja la sesión en un estado
  // consistente con un error explicando por qué.
  const handleGuardarCriterios = async () => {
    setGuardandoCriterios(true)
    setCriteriosError(null)
    try {
      const res = await flushCambios().then(() =>
        modulosApi.setCriterios(questionsView.moduleId, localCriterios),
      )
      setCriteriosResultado(res.resolucion)
    } catch (err) {
      setCriteriosError(
        `${err.message} — se recargó el contenido del borrador desde el servidor, así que revisá los criterios antes de volver a guardar.`,
      )
    } finally {
      setCriteriosModal(false)
      sessionKeyRef.current = null
      await banco.refresh()
      setGuardandoCriterios(false)
    }
  }

  // Los parámetros de examen se guardan solos, sin flushCambios: a diferencia de
  // los criterios, el PUT no toca los pivots, así que no puede pisar ni pelearse
  // con el staging de preguntas.
  const handleGuardarParametros = async () => {
    setGuardandoParametros(true)
    setParametrosError(null)
    try {
      await modulosApi.setParametros(
        questionsView.moduleId,
        parametrosAPayload(localParametros),
      )
      setParametrosGuardados(localParametros)
    } catch (err) {
      setParametrosError(err.message)
    } finally {
      setGuardandoParametros(false)
    }
  }

  // Igual que los parámetros: el PATCH no toca pivots, así que no puede
  // pisarse con el staging de preguntas y no necesita flushCambios() antes.
  const handleGuardarDetalles = async () => {
    if (!localDetalles.nombre.trim()) {
      setDetallesError('Poné un nombre para el módulo.')
      return
    }
    const trimmedVigencia = localDetalles.vigenciaMeses.trim()
    let vigenciaMeses = null
    if (trimmedVigencia) {
      const n = Number(trimmedVigencia)
      if (!Number.isInteger(n) || n < 1) {
        setDetallesError('La vigencia tiene que ser un número entero de al menos 1 mes, o vacío para que no venza nunca.')
        return
      }
      vigenciaMeses = n
    }
    setGuardandoDetalles(true)
    setDetallesError(null)
    try {
      await modulosApi.update(questionsView.moduleId, {
        nombre: localDetalles.nombre.trim(),
        descripcion: localDetalles.descripcion.trim(),
        vigenciaMeses,
      })
      const guardado = { ...localDetalles, vigenciaMeses: vigenciaMeses != null ? String(vigenciaMeses) : '' }
      setLocalDetalles(guardado)
      setDetallesGuardados(guardado)
      await loadModules()
    } catch (err) {
      setDetallesError(err.message)
    } finally {
      setGuardandoDetalles(false)
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
    const criteriosVista = view.readOnly ? banco.criterios : localCriterios
    // Comparado contra lo guardado en el servidor: habilita "Guardar criterios".
    const criteriosGuardadosClave = banco.criterios.map(claveCriterio).sort().join('|')
    const criteriosLocalesClave = localCriterios
      .filter((c) => c.baseConocimientoId)
      .map(claveCriterio)
      .sort()
      .join('|')
    const criteriosDirty = criteriosGuardadosClave !== criteriosLocalesClave
    // En solo lectura los valores salen del servidor y no del formulario: la
    // vista de una versión publicada nunca pasó por el efecto que llena
    // localParametros (sólo corre sobre borradores editables).
    const parametrosVista = view.readOnly
      ? parametrosDesdeVersion(banco.version)
      : localParametros
    const parametrosDirty = parametrosDistintos(localParametros, parametrosGuardados)
    // Mismo criterio que parametrosVista: en solo lectura sale directo del
    // módulo (no hay staging que llenar sobre una versión publicada/archivada).
    const detallesVista = view.readOnly
      ? {
          nombre: questionsModule?.nombre ?? '',
          descripcion: questionsModule?.descripcion ?? '',
          vigenciaMeses: questionsModule?.vigenciaMeses != null ? String(questionsModule.vigenciaMeses) : '',
        }
      : localDetalles
    const detallesDirty =
      localDetalles.nombre !== detallesGuardados.nombre ||
      localDetalles.descripcion !== detallesGuardados.descripcion ||
      localDetalles.vigenciaMeses !== detallesGuardados.vigenciaMeses
    const pendientesPreguntas = contarPendientes()

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
                {/* Sólo si la versión ya tiene número: en un borrador
                    `formatVersionNumero` cae en el fallback "Borrador" y
                    duplicaba el badge de al lado. */}
                {banco.version?.anio != null && (
                  <span className="text-slate-400 text-xs font-mono">{formatVersionNumero(banco.version)}</span>
                )}
              </div>
              <div className="text-slate-400 text-[10px] font-mono">{asignadasVista.length} preguntas</div>
            </div>
          </div>
          {!view.readOnly && (
            /* "Activar" es la acción principal y queda sola a la derecha.
               Descartar es la acción opuesta: pasa a terciario (ghost) y del
               otro lado del separador, para que no compitan. El modal de
               confirmación es el mismo y sigue explicando la consecuencia. */
            <div className="flex items-center gap-2">
              <BancoAcciones
                backendId={view.moduleId}
                assignedIds={new Set(localAsignadas.map((m) => m.preguntaId))}
                baseOrden={localAsignadas.length}
                onAssignExisting={handleAsignarLocal}
                onAssignNew={handleNuevaPreguntaLocal}
              />
              <Button variant="ghost" size="sm" onClick={() => setCancelarBorradorModal(questionsModule)}>
                {questionsModule?.vigente?.estado === 'BORRADOR' ? 'Eliminar módulo' : 'Cancelar borrador'}
              </Button>
              <div className="w-px h-5 bg-slate-200" />
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

        <div className="border border-slate-200 rounded bg-white">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">
                Detalles del módulo
              </span>
              <p className="text-slate-400 text-[11px] mt-0.5">
                {view.readOnly
                  ? 'Nombre, descripción y vigencia del módulo (no de esta versión puntual).'
                  : 'Nombre, descripción y cada cuánto vence una aprobación. No se congela con la versión.'}
              </p>
            </div>
            {!view.readOnly && (
              <Button size="sm" onClick={handleGuardarDetalles} disabled={!detallesDirty || guardandoDetalles}>
                {guardandoDetalles ? 'Guardando...' : 'Guardar detalles'}
              </Button>
            )}
          </div>

          {detallesError && (
            <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 text-red-700 text-xs">{detallesError}</div>
          )}

          {view.readOnly ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm px-4 py-3">
              <div className="col-span-2">
                <dt className="text-slate-400 text-xs font-medium mb-0.5">Nombre</dt>
                <dd className="text-slate-900">{detallesVista.nombre}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-400 text-xs font-medium mb-0.5">Descripción</dt>
                <dd className="text-slate-900 whitespace-pre-wrap">{detallesVista.descripcion || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-xs font-medium mb-0.5">Vigencia</dt>
                <dd className="text-slate-900 font-mono">
                  {detallesVista.vigenciaMeses
                    ? `Cada ${detallesVista.vigenciaMeses} mes${detallesVista.vigenciaMeses !== '1' ? 'es' : ''}`
                    : 'no vence nunca'}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="px-4 py-3 space-y-4">
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-1">Nombre</label>
                <input
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                  value={localDetalles.nombre}
                  onChange={(e) => setLocalDetalles((d) => ({ ...d, nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-1">
                  Descripción <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                  value={localDetalles.descripcion}
                  onChange={(e) => setLocalDetalles((d) => ({ ...d, descripcion: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 text-sm font-medium mb-1">Vigencia (meses)</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                    placeholder="no vence nunca"
                    value={localDetalles.vigenciaMeses}
                    onChange={(e) => setLocalDetalles((d) => ({ ...d, vigenciaMeses: e.target.value }))}
                  />
                  <p className="text-slate-400 text-[11px] mt-1">
                    Cada cuántos meses hay que recertificarse. Vacío = no vence nunca.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <ParametrosExamenPanel
          valores={parametrosVista}
          readOnly={view.readOnly}
          onChange={setLocalParametros}
          onGuardar={handleGuardarParametros}
          guardando={guardandoParametros}
          error={parametrosError}
          dirty={parametrosDirty}
        />

        <CriteriosPanel
          criterios={criteriosVista}
          readOnly={view.readOnly}
          onChange={setLocalCriterios}
          onGuardar={() => { setCriteriosError(null); setCriteriosModal(true) }}
          guardando={guardandoCriterios}
          error={criteriosError}
          dirty={criteriosDirty}
        />

        {criteriosResultado && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs rounded px-3 py-2 flex items-center justify-between gap-3">
            <span>
              Criterios guardados: se agregaron <strong>{criteriosResultado.agregadas}</strong>,
              se quitaron <strong>{criteriosResultado.quitadas}</strong> y
              se conservaron <strong>{criteriosResultado.conservadas}</strong> preguntas.
            </span>
            <button
              type="button"
              className="text-indigo-500 hover:text-indigo-800 font-semibold flex-shrink-0"
              onClick={() => setCriteriosResultado(null)}
            >
              Cerrar
            </button>
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
          open={criteriosModal}
          onClose={() => setCriteriosModal(false)}
          title="Guardar criterios"
          footer={
            <>
              <Button variant="secondary" onClick={() => setCriteriosModal(false)} disabled={guardandoCriterios}>
                Cancelar
              </Button>
              <Button onClick={handleGuardarCriterios} disabled={guardandoCriterios}>
                {guardandoCriterios ? 'Guardando...' : 'Guardar criterios'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {/* El error no se muestra acá: ante una falla el modal se cierra y
                el contenido se recarga del servidor, así que el mensaje va en el
                panel, al lado de los criterios ya resincronizados. */}
            <p className="text-slate-600 text-sm">
              Se van a sumar al módulo las preguntas del banco que correspondan a estos criterios, y se van a{' '}
              <strong>quitar</strong> las que había traído un criterio que ya no está — incluidas las que hayas
              desactivado a mano.
            </p>
            <p className="text-slate-500 text-sm">
              Las preguntas que agregaste vos desde el banco no se tocan, y las que ya trajo un criterio y siguen
              correspondiendo quedan como están (si las desactivaste, siguen desactivadas).
            </p>
            {/* A diferencia del resto del editor, esto SÍ pega al backend en el
                acto — pero el aviso se gradúa según la consecuencia real. Sin
                cambios pendientes no se arrastra nada y es un detalle: va en
                gris. Con cambios pendientes sí sorprende, porque guardar
                criterios se lleva puestos los de preguntas (flushCambios corre
                primero): ahí va en ámbar. Lo que no es tolerable es que actúe
                sin decirlo. */}
            {pendientesPreguntas > 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded px-3 py-2">
                Tenés <strong>{pendientesPreguntas}</strong> cambio{pendientesPreguntas !== 1 ? 's' : ''} de preguntas
                sin guardar: se {pendientesPreguntas !== 1 ? 'van' : 'va'} a guardar junto con los criterios, ahora mismo.
              </div>
            ) : (
              <p className="text-slate-400 text-xs">
                Esto se guarda ahora mismo (no espera a "Guardar y volver").
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
          {/* Qué se le está mostrando a gente de afuera tiene que verse de un
              vistazo en el listado, no sólo entrando al detalle de cada módulo. */}
          {row.demoPublico && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              Demo
            </span>
          )}
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
    // Cada acción es su propia columna (en vez de un solo bloque flex) para que
    // el ancho de cada botón lo fije la tabla por columna y todas las filas
    // queden alineadas verticalmente, aunque el label o la cantidad de botones
    // cambie según el estado del módulo (nunca publicado / con borrador / etc.).
    {
      key: '_verPreguntas',
      label: 'Acciones',
      render: (_v, row) =>
        row.vigente?.estado === 'BORRADOR' ? null : (
          <Button variant="ghost" size="sm" onClick={() => verVigente(row)}>Ver preguntas</Button>
        ),
    },
    {
      key: '_editarContenido',
      label: '',
      render: (_v, row) => {
        if (row.vigente?.estado === 'BORRADOR') {
          return <Button variant="ghost" size="sm" onClick={() => editarSinPublicar(row)}>Editar contenido</Button>
        }
        if (row.borradorId) {
          return <Button variant="ghost" size="sm" onClick={() => continuarBorrador(row)}>Continuar borrador</Button>
        }
        return (
          <Button
            variant="ghost"
            size="sm"
            disabled={creandoBorradorId === row.id}
            onClick={() => crearBorradorYEditar(row)}
          >
            {creandoBorradorId === row.id ? 'Creando borrador...' : 'Editar contenido'}
          </Button>
        )
      },
    },
    {
      key: '_historial',
      label: '',
      render: (_v, row) => <Button variant="ghost" size="sm" onClick={() => verHistorial(row)}>Historial</Button>,
    },
    {
      key: '_verDetalles',
      label: '',
      render: (_v, row) => <Button variant="ghost" size="sm" onClick={() => openDetalleModulo(row)}>Ver detalles</Button>,
    },
    {
      key: '_toggleActivo',
      label: '',
      render: (_v, row) => (
        <Button
          variant={row.activo === false ? 'ghost' : 'danger'}
          size="sm"
          onClick={() => setDesactivarModal(row)}
        >
          {row.activo === false ? 'Activar' : 'Desactivar'}
        </Button>
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
      />

      <Modal
        open={!!moduleModal}
        onClose={() => setModuleModal(null)}
        title="Nuevo módulo"
        size="lg"
        footer={
          <>
            <span className="text-slate-500 text-xs font-mono mr-auto">
              {moduleCriteriosValidos.length > 0 && (
                <>{moduleCriteriosValidos.length} criterio{moduleCriteriosValidos.length !== 1 ? 's' : ''} · </>
              )}
              {modulePreguntaIds.size} pregunta{modulePreguntaIds.size !== 1 ? 's' : ''} seleccionada{modulePreguntaIds.size !== 1 ? 's' : ''}
            </span>
            <Button variant="secondary" onClick={() => setModuleModal(null)}>Cancelar</Button>
            <Button onClick={handleSaveModule} disabled={saving}>
              {saving
                ? 'Guardando...'
                : modulePreguntaIds.size > 0 || moduleCriteriosValidos.length > 0
                  ? 'Crear y configurar'
                  : 'Crear'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {moduleError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{moduleError}</div>
          )}
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
          {/* Modo invitado. Va junto a la metadata del módulo (y no con "Cómo se
              rinde") porque no es un parámetro de la versión: no se congela al
              publicar y se puede sacar en cualquier momento sin versionar nada. */}
          <div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-red-600"
                checked={moduleForm.demoPublico}
                onChange={(e) => setModuleForm((f) => ({ ...f, demoPublico: e.target.checked }))}
              />
              <span className="text-sm">
                <span className="text-slate-700 font-medium">Mostrar en el modo demostración</span>
                <span className="block text-slate-500 text-xs mt-0.5">
                  Cualquiera puede rendirlo desde la tablet sin estar en el sistema, dando
                  sólo su nombre. Los resultados quedan aparte y no cuentan como capacitación.
                </span>
              </span>
            </label>
          </div>
          <div className="pt-2 border-t border-slate-200">
            <label className="block text-slate-700 text-sm font-medium mb-2">
              Cómo se rinde <span className="text-slate-400 font-normal">(opcional — se puede cambiar mientras sea borrador)</span>
            </label>
            {/* Sin marco propio ni botón de guardar: acá se persisten como parte
                del POST del módulo, no por su endpoint. */}
            <ParametrosExamenPanel
              valores={moduleParametros}
              onChange={setModuleParametros}
              desnudo
            />
          </div>

          <div className="pt-2 border-t border-slate-200">
            <label className="block text-slate-700 text-sm font-medium mb-2">
              Qué evalúa <span className="text-slate-400 font-normal">(opcional — las preguntas de las bases elegidas entran solas)</span>
            </label>
            {/* Controlado y sin su botón: el módulo todavía no existe cuando se
                eligen los criterios, así que el PUT sale recién en el submit. */}
            <CriteriosPanel
              criterios={moduleCriterios}
              onChange={setModuleCriterios}
              mostrarGuardar={false}
            />
          </div>

          <div className="pt-2 border-t border-slate-200">
            <label className="block text-slate-700 text-sm font-medium mb-1">
              Preguntas sueltas <span className="text-slate-400 font-normal">(opcional — el módulo queda como borrador igual)</span>
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
            {/* Nombre, descripción y vigencia se editan desde "Editar contenido"
                (junto con el resto del contenido del módulo), no acá — este modal
                queda de solo lectura salvo el toggle de demo de abajo. */}
            <div>
              <div className="text-slate-400 text-xs font-medium mb-1">Estado</div>
              <div className="text-slate-900 text-sm">{detalleModal.activo === false ? 'Inactivo' : 'Activo'}</div>
            </div>
            {/* La ÚNICA acción de este modal, que hasta acá era de solo lectura
                — ver el comentario de handleToggleDemo(). */}
            <div className="pt-3 border-t border-slate-200">
              <div className="text-slate-400 text-xs font-medium mb-1">Modo demostración</div>
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="text-slate-900">
                    {detalleModal.demoPublico
                      ? 'Se ofrece a quien pruebe la app sin estar en el sistema'
                      : 'No se ofrece en la demo'}
                  </div>
                  {detalleModal.demoPublico && (
                    <div className="text-slate-500 text-xs mt-0.5">
                      Los resultados quedan aparte y no cuentan como capacitación.
                    </div>
                  )}
                </div>
                <Button
                  variant={detalleModal.demoPublico ? 'secondary' : 'primary'}
                  size="sm"
                  disabled={guardandoDemo}
                  onClick={handleToggleDemo}
                >
                  {guardandoDemo
                    ? 'Guardando…'
                    : detalleModal.demoPublico
                      ? 'Quitar de la demo'
                      : 'Agregar a la demo'}
                </Button>
              </div>
              {demoError && (
                <div className="mt-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
                  {demoError}
                </div>
              )}
            </div>
            {/* Cómo se rinde sale de la versión vigente, no del módulo: son
                parámetros congelados por versión. Un módulo sin ninguna versión
                todavía no tiene nada que mostrar acá. */}
            {detalleModal.vigente && (
              <div className="pt-3 border-t border-slate-200">
                <div className="text-slate-400 text-xs font-medium mb-2">
                  Cómo se rinde <span className="font-normal">({formatVersionNumero(detalleModal.vigente)})</span>
                </div>
                <ParametrosExamenPanel
                  valores={parametrosDesdeVersion(detalleModal.vigente)}
                  readOnly
                  desnudo
                />
              </div>
            )}
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
