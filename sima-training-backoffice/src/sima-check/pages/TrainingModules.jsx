import { useEffect, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { modulosApi } from '../../core/api/modulos'
import { useBancoModulo, estadoVersionBadge, formatVersionNumero } from '../components/bancoModulo'
import { BancoAcciones, PreguntasAsignadasPanel } from '../components/BancoPreguntas'

const EMPTY_MODULE_FORM = { nombre: '', descripcion: '' }

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

  // Module modal (metadata: nombre/descripcion). El contenido se edita por versión.
  const [moduleModal, setModuleModal] = useState(null)
  const [moduleForm, setModuleForm] = useState(EMPTY_MODULE_FORM)
  const [saving, setSaving] = useState(false)

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

  // Banco de preguntas de la versión abierta en la vista "questions": la vigente
  // por default, o una versión puntual (el borrador, o una del historial) si
  // view.versionId la especifica. El hook se llama incondicionalmente; con
  // moduleId undefined queda inerte.
  const questionsView = view.type === 'questions' ? view : null
  const questionsModule = questionsView ? modules.find((m) => m.id === questionsView.moduleId) : null
  const banco = useBancoModulo(questionsView?.moduleId, questionsView?.versionId)

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

  // --- Module CRUD (metadata) ---
  const openCreateModule = () => {
    setModuleForm(EMPTY_MODULE_FORM)
    setModuleModal({ mode: 'create' })
  }

  const openEditModule = (mod) => {
    setModuleForm({ nombre: mod.nombre, descripcion: mod.descripcion ?? '' })
    setModuleModal({ mode: 'edit', data: mod })
  }

  const handleSaveModule = async () => {
    if (!moduleForm.nombre.trim()) return
    setSaving(true)
    setError(null)
    try {
      const payload = { nombre: moduleForm.nombre.trim(), descripcion: moduleForm.descripcion.trim() || undefined }
      if (moduleModal.mode === 'create') {
        await modulosApi.create(payload)
      } else {
        await modulosApi.update(moduleModal.data.id, payload)
      }
      loadModules()
      setModuleModal(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
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

        <PreguntasAsignadasPanel asignadas={banco.asignadas} error={banco.error} />

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
      render: (vigente) => (
        <div className="flex items-center gap-2">
          {estadoVersionBadge(vigente?.estado)}
          <span className="text-slate-400 text-xs font-mono">{formatVersionNumero(vigente)}</span>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Capacitaciones</h2>
          <p className="text-slate-400 text-sm">{modules.length} módulos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreateModule}>+ Nuevo módulo</Button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>}
      {loading && <div className="text-slate-400 text-xs font-mono">Cargando...</div>}

      <Table
        columns={moduleColumns}
        data={modules}
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
              <Button variant="ghost" size="sm" onClick={() => openEditModule(row)}>Editar</Button>
            </>
          )
        }}
      />

      <Modal
        open={!!moduleModal}
        onClose={() => setModuleModal(null)}
        title={moduleModal?.mode === 'create' ? 'Nuevo módulo' : 'Editar módulo'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModuleModal(null)}>Cancelar</Button>
            <Button onClick={handleSaveModule} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
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
