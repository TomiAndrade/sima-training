import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import MultiSelectFilter from '../../components/MultiSelectFilter'
import { imagenUrl, IMAGEN_MAX_BYTES, IMAGEN_MIME_TYPES, preguntasApi } from '../../core/api/preguntas'
import { etiquetasApi } from '../../core/api/etiquetas'
import { modulosApi } from '../../core/api/modulos'
import { backendTypeBadge } from './bancoModulo'

// Componentes compartidos para gestionar el banco de preguntas de un módulo
// (versión BORRADOR) contra la API real. Los usan tanto la tab "Preguntas"
// (Questions.jsx) como la vista de preguntas dentro de "Capacitaciones"
// (TrainingModules.jsx), para no duplicar el flujo.
// El hook `useBancoModulo` y `backendTypeBadge` viven en ./bancoModulo.

const inputCls = 'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

const CATEGORIAS_ETIQUETA = ['TEMA', 'AREA', 'NORMA', 'ROL']

// Picker de módulos inline (siempre abierto): buscador + lista de checkboxes.
// Los tildados salen de `selectedIds`; togglear marca/desmarca. Mismo estilo que
// la lista del banco en AsignarPreguntaModal.
function ModulosPicker({ options, selectedIds, onChange }) {
  const [q, setQ] = useState('')
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
  const toggle = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }
  return (
    <div className="space-y-2">
      <input
        className={inputCls}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar módulo..."
      />
      <div className="border border-slate-200 rounded max-h-64 overflow-y-auto divide-y divide-slate-100">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-slate-400 text-xs font-mono">— Sin módulos —</div>
        )}
        {filtered.map((o) => (
          <label key={o.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm">
            <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggle(o.id)} />
            <span className="text-slate-700 truncate">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// Botones de acción + ambos modales, listos para colocar en el header.
// `onAssignExisting`/`onAssignNew` son opcionales: si se pasan, los modales
// dejan de pegarle al backend y en cambio le devuelven al padre lo elegido
// (modo staged — ver TrainingModules.jsx). Sin ellos, comportamiento actual
// (asignación inmediata + `onChanged` para refrescar).
export function BancoAcciones({ backendId, assignedIds, baseOrden, onChanged, onAssignExisting, onAssignNew }) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [nuevaOpen, setNuevaOpen] = useState(false)

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => setNuevaOpen(true)}>Nueva pregunta</Button>
      <Button variant="success" onClick={() => setAssignOpen(true)}>Asignar pregunta</Button>

      {assignOpen && (
        <AsignarPreguntaModal
          onClose={() => setAssignOpen(false)}
          backendId={backendId}
          assignedIds={assignedIds}
          baseOrden={baseOrden}
          onAssigned={onChanged}
          onAssign={onAssignExisting}
        />
      )}
      {nuevaOpen && (
        <NuevaPreguntaModal
          onClose={() => setNuevaOpen(false)}
          backendId={backendId}
          baseOrden={baseOrden}
          onAssigned={onChanged}
          onAssign={onAssignNew}
        />
      )}
    </div>
  )
}

// Panel con las preguntas ya asignadas desde el banco (feedback del backend).
// `onToggle` es opcional: si se pasa, cada fila suma un botón Activar/Desactivar
// (baja lógica por módulo, PATCH /modulos/:id/preguntas/:preguntaId) y las
// preguntas desactivadas se muestran atenuadas. `onRemove` es opcional también
// (unassign duro, DELETE /modulos/:id/preguntas/:preguntaId — solo válido en un
// BORRADOR): saca la fila del todo en vez de dejarla atenuada, para que el
// editor no se llene de preguntas descartadas que ya nadie va a reactivar. Sin
// `onToggle`/`onRemove` el panel queda puramente de lectura (vistas read-only
// del historial/vigente).
// Chequeo de formato y peso antes de subir, para avisar sin round-trip. La
// autoridad sigue siendo el backend (detecta el formato por magic bytes, no por
// el mimetype que declara el browser). Devuelve el error o null.
function validarImagen(file) {
  if (!IMAGEN_MIME_TYPES.includes(file.type)) {
    return 'La imagen debe ser PNG, JPG o WEBP'
  }
  if (file.size > IMAGEN_MAX_BYTES) {
    return `La imagen supera el máximo de ${IMAGEN_MAX_BYTES / 1024 / 1024} MB`
  }
  return null
}

// Miniatura de la imagen del enunciado. Devuelve null si la pregunta no tiene,
// así el llamador la puede poner sin condicionar. Decorativa (alt vacío): el
// enunciado que va al lado ya dice de qué se trata.
function ImagenEnunciado({ imagen, className = 'w-8 h-8' }) {
  const url = imagenUrl(imagen)
  if (!url) return null
  return (
    <img
      src={url}
      alt=""
      className={`${className} object-cover rounded border border-slate-200 bg-slate-50 flex-shrink-0`}
    />
  )
}

export function PreguntasAsignadasPanel({ asignadas, error, onToggle, onRemove, togglingId }) {
  return (
    <div className="border border-slate-200 rounded bg-white">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">
          Preguntas asignadas desde el banco (backend)
        </span>
        <span className="text-slate-400 text-[10px] font-mono">{asignadas.length}</span>
      </div>
      {error && <div className="px-4 py-3 text-red-600 text-xs">{error}</div>}
      {!error && asignadas.length === 0 && (
        <div className="px-4 py-6 text-center text-slate-400 text-[11px] font-mono uppercase tracking-widest">
          — Sin preguntas asignadas todavía —
        </div>
      )}
      {asignadas.length > 0 && (
        <div className="divide-y divide-slate-100">
          {[...asignadas]
            .sort((a, b) => a.orden - b.orden)
            .map((mvp) => {
              const enPapelera = mvp.pregunta.activa === false
              return (
                <div key={mvp.preguntaId} className={`px-4 py-2.5 flex items-center gap-3 ${mvp.activa === false ? 'opacity-50' : ''}`}>
                  <span className="text-slate-400 text-xs font-mono w-6">{mvp.orden}</span>
                  {backendTypeBadge(mvp.pregunta.tipo)}
                  <ImagenEnunciado imagen={mvp.pregunta.imagen} />
                  <span className="text-slate-700 text-sm line-clamp-1 flex-1">{mvp.pregunta.texto}</span>
                  {enPapelera ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-600 flex-shrink-0">
                      En papelera
                    </span>
                  ) : mvp.activa === false && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-400 flex-shrink-0">
                      Inactiva
                    </span>
                  )}
                  {(onToggle || onRemove) && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {onToggle && (
                        enPapelera ? (
                          <span className="text-slate-400 text-[11px]">Recuperala desde Preguntas</span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={togglingId === mvp.preguntaId}
                            onClick={() => onToggle(mvp)}
                          >
                            {togglingId === mvp.preguntaId ? '...' : mvp.activa ? 'Desactivar' : 'Activar'}
                          </Button>
                        )
                      )}
                      {onRemove && (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={togglingId === mvp.preguntaId}
                          onClick={() => onRemove(mvp)}
                        >
                          {togglingId === mvp.preguntaId ? '...' : 'Quitar'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

// Picker embebido del banco: buscador + filtros (etiqueta/categoría) + lista
// con checkboxes contra GET /preguntas. Lo usan tanto `AsignarPreguntaModal`
// (sumar preguntas a un módulo ya creado, con `excludeIds` de las ya
// asignadas) como el modal "Nuevo módulo" de TrainingModules.jsx (arrancar
// el borrador ya con preguntas elegidas, sin exclusiones porque el módulo
// todavía no existe).
export function PreguntaBancoPicker({ selectedIds, onToggle, excludeIds }) {
  const [q, setQ] = useState('')
  const [etiquetaId, setEtiquetaId] = useState('')
  const [categoria, setCategoria] = useState('')
  const [etiquetas, setEtiquetas] = useState([])
  const [banco, setBanco] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    etiquetasApi.list().then(setEtiquetas).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      preguntasApi
        .list({ q: q.trim() || undefined, etiqueta: etiquetaId || undefined, categoria: categoria || undefined })
        .then(setBanco)
        .catch(() => setBanco([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [q, etiquetaId, categoria])

  return (
    <div className="space-y-3">
      <input
        className={inputCls}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por texto..."
      />
      <div className="grid grid-cols-2 gap-2">
        <select className={inputCls} value={etiquetaId} onChange={(e) => setEtiquetaId(e.target.value)}>
          <option value="">Todas las etiquetas</option>
          {etiquetas.map((et) => <option key={et.id} value={et.id}>{et.nombre}</option>)}
        </select>
        <select className={inputCls} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS_ETIQUETA.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="border border-slate-200 rounded max-h-72 overflow-y-auto divide-y divide-slate-100">
        {loading && <div className="px-3 py-6 text-center text-slate-400 text-xs font-mono">Buscando...</div>}
        {!loading && banco.length === 0 && (
          <div className="px-3 py-6 text-center text-slate-400 text-xs font-mono">— Sin resultados —</div>
        )}
        {!loading && banco.map((p) => {
          const yaAsignada = excludeIds?.has(p.id)
          return (
            <label
              key={p.id}
              className={`flex items-start gap-3 px-3 py-2.5 ${yaAsignada ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:bg-slate-50'}`}
            >
              <input
                type="checkbox"
                className="mt-1"
                disabled={yaAsignada}
                checked={selectedIds.has(p.id)}
                onChange={() => onToggle(p.id, p)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {backendTypeBadge(p.tipo)}
                  {yaAsignada && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-slate-200 text-slate-500">
                      Ya asignada
                    </span>
                  )}
                </div>
                <div className="text-slate-700 text-sm mt-1 line-clamp-2">{p.texto}</div>
                {p.etiquetas?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.etiquetas.map((pe) => (
                      <span key={pe.etiquetaId} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500">
                        {pe.etiqueta.nombre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

// Modal "Asignar pregunta": el picker del banco de arriba + acción para
// asignar las tildadas a un módulo ya creado, deshabilitando las que ya
// están asignadas. El padre solo la monta mientras está abierta, así el
// estado arranca limpio en cada apertura sin necesidad de resetearlo en un efecto.
// `onAssign(items)` opcional: si se pasa, en vez de pegarle al backend le
// devuelve al padre los items elegidos (con la pregunta completa incluida,
// para poder renderizarlos sin ir al servidor — modo staged).
export function AsignarPreguntaModal({ onClose, backendId, assignedIds, baseOrden, onAssigned, onAssign }) {
  const [selected, setSelected] = useState(new Map())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const toggle = (id, pregunta) => {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, pregunta)
      return next
    })
  }

  const handleAsignar = async () => {
    setSaving(true)
    setError(null)
    try {
      const items = [...selected.entries()].map(([preguntaId, pregunta], i) => ({
        preguntaId,
        orden: baseOrden + i + 1,
        obligatoria: true,
        pregunta,
      }))
      if (onAssign) {
        onAssign(items)
      } else {
        await modulosApi.asignarPreguntas(
          backendId,
          items.map(({ preguntaId, orden, obligatoria }) => ({ preguntaId, orden, obligatoria })),
        )
        await onAssigned()
      }
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Asignar pregunta del banco"
      footer={
        <>
          <span className="text-slate-500 text-xs font-mono mr-auto">
            {selected.size} pregunta{selected.size !== 1 ? 's' : ''} seleccionada{selected.size !== 1 ? 's' : ''}
          </span>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleAsignar} disabled={selected.size === 0 || saving}>
            {saving ? 'Asignando...' : 'Asignar seleccionadas'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>}
        <PreguntaBancoPicker selectedIds={new Set(selected.keys())} onToggle={toggle} excludeIds={assignedIds} />
      </div>
    </Modal>
  )
}

const EMPTY_BACKEND_FORM = { texto: '', tipo: 'VERDADERO_FALSO', opciones: ['', '', '', ''], respuestaCorrecta: '', puntajeMax: '' }

const OPCION_LETRAS = ['a', 'b', 'c', 'd']

// Modal "Nueva pregunta": crea en el banco (POST /preguntas, siempre
// inmediato — es un alta permanente, no algo del borrador) y, si se pasa un
// backendId (módulo), la asigna en el mismo gesto (POST /modulos/:id/preguntas).
// Sin backendId, la pregunta queda creada en el banco sin asignar (misma
// semántica que "sin módulo destino" en la importación de Excel).
// `onAssign(pregunta)` opcional: si se pasa, la asignación al `backendId`
// puntual queda a cargo del padre (modo staged) en vez de pegarle al backend;
// los demás módulos elegidos (si hay) se siguen asignando de inmediato, están
// fuera del alcance de ese borrador.
// El padre solo la monta mientras está abierta (estado arranca limpio).
export function NuevaPreguntaModal({ onClose, backendId, onAssigned, onAssign }) {
  const [form, setForm] = useState(EMPTY_BACKEND_FORM)
  const [modules, setModules] = useState([])
  // Si el modal se abre desde la vista por-módulo (backendId), ese módulo arranca
  // preseleccionado y editable (se pueden sumar otros). Sin backendId, vacío.
  const [selectedModuleIds, setSelectedModuleIds] = useState(() => new Set(backendId ? [backendId] : []))
  // La imagen del enunciado se queda en el browser hasta confirmar: recién en
  // handleGuardar se sube. Así cambiarla o quitarla antes de crear la pregunta
  // es estado local, y abrir y cerrar el modal no deja archivos huérfanos.
  const [imagenFile, setImagenFile] = useState(null)
  // Mismo criterio para las opciones de OPCIONES_IMAGEN: 4 slots que sostienen
  // el File hasta confirmar.
  const [opcionFiles, setOpcionFiles] = useState([null, null, null, null])
  // Cuál de las opciones es la correcta. Se guarda el File y no un índice
  // porque las claves todavía no existen (se generan al subir, en handleGuardar)
  // y porque una referencia no se desincroniza al quitar o reemplazar un slot.
  const [correctaFile, setCorrectaFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const necesitaOpciones = form.tipo === 'OPCION_MULTIPLE' || form.tipo === 'OPCIONES_IMAGEN'
  const opcionesSonImagen = form.tipo === 'OPCIONES_IMAGEN'

  useEffect(() => {
    modulosApi.list().then(setModules).catch(() => {})
  }, [])

  const imagenPreview = useMemo(
    () => (imagenFile ? URL.createObjectURL(imagenFile) : null),
    [imagenFile],
  )
  // Libera el object URL anterior cuando cambia la imagen o se cierra el modal.
  useEffect(() => {
    if (!imagenPreview) return
    return () => URL.revokeObjectURL(imagenPreview)
  }, [imagenPreview])

  const opcionPreviews = useMemo(
    () => opcionFiles.map((f) => (f ? URL.createObjectURL(f) : null)),
    [opcionFiles],
  )
  useEffect(() => {
    return () => opcionPreviews.forEach((url) => url && URL.revokeObjectURL(url))
  }, [opcionPreviews])

  // Devuelve el File elegido si pasa las validaciones, o null (dejando el error
  // seteado). Limpia el input para poder volver a elegir el mismo archivo
  // después de quitarlo — si no, el change no dispara.
  const tomarArchivo = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return null
    const err = validarImagen(file)
    if (err) {
      setError(err)
      return null
    }
    setError(null)
    return file
  }

  const handleImagenChange = (e) => {
    const file = tomarArchivo(e)
    if (file) setImagenFile(file)
  }

  const handleOpcionChange = (i, e) => {
    const file = tomarArchivo(e)
    if (!file) return
    setOpcionFiles((prev) => prev.map((f, idx) => (idx === i ? file : f)))
  }

  const quitarOpcion = (i) => {
    const quitado = opcionFiles[i]
    setOpcionFiles((prev) => prev.map((f, idx) => (idx === i ? null : f)))
    // Si la que se quita era la marcada como correcta, la marca se cae con ella.
    if (quitado && quitado === correctaFile) setCorrectaFile(null)
  }

  const handleTipoChange = (tipo) => {
    // Las opciones no sobreviven al cambio de tipo: pasar de texto a imagen (o
    // al revés) dejaría textos donde van claves, o archivos que ya no se usan.
    setForm((f) => ({ ...f, tipo, respuestaCorrecta: '', opciones: ['', '', '', ''] }))
    setOpcionFiles([null, null, null, null])
    setCorrectaFile(null)
  }

  const moduleOptions = useMemo(
    () => modules.map((m) => ({ id: m.id, label: m.nombre })),
    [modules],
  )

  const handleGuardar = async () => {
    if (!form.texto.trim()) {
      setError('El enunciado es obligatorio')
      return
    }
    // Los archivos cargados, sin los slots vacíos. Es el orden en el que van a
    // quedar las opciones.
    const files = opcionFiles.filter(Boolean)
    if (opcionesSonImagen) {
      // Se chequea acá para no gastar subidas en un alta que el backend va a
      // rechazar igual (valida las mismas dos reglas).
      if (files.length < 2) {
        setError('Se necesitan al menos 2 imágenes')
        return
      }
      if (!correctaFile) {
        setError('Elegí cuál es la opción correcta')
        return
      }
    }

    setSaving(true)
    setError(null)
    // Claves subidas en este intento, para poder limpiarlas si el alta no llega
    // a completarse.
    const subidas = []
    let creada = false
    try {
      const imagen = imagenFile ? (await preguntasApi.subirImagen(imagenFile)).imagen : undefined
      if (imagen) subidas.push(imagen)

      let opciones
      let respuestaCorrecta = form.respuestaCorrecta.trim() || undefined
      if (opcionesSonImagen) {
        opciones = await Promise.all(
          files.map(async (f) => (await preguntasApi.subirImagen(f)).imagen),
        )
        subidas.push(...opciones)
        // Recién acá existen las claves: la opción correcta se venía trackeando
        // por referencia al File, y su clave es la que quedó en su misma
        // posición del array subido.
        respuestaCorrecta = opciones[files.indexOf(correctaFile)]
      } else if (necesitaOpciones) {
        opciones = form.opciones.filter(Boolean)
      }

      const pregunta = await preguntasApi.create({
        texto: form.texto.trim(),
        tipo: form.tipo,
        respuestaCorrecta,
        puntajeMax: form.puntajeMax ? Number(form.puntajeMax) : undefined,
        ...(opciones ? { opciones } : {}),
        imagen,
      })
      creada = true

      // Asigna a cada módulo elegido. El orden lo appendea el backend (sin orden).
      for (const moduloId of selectedModuleIds) {
        if (onAssign && moduloId === backendId) {
          onAssign(pregunta)
        } else {
          await modulosApi.asignarPreguntas(moduloId, [
            { preguntaId: pregunta.id, obligatoria: true },
          ])
        }
      }
      if (!onAssign) await onAssigned()
      onClose()
    } catch (err) {
      // Solo si la pregunta no llegó a crearse: una vez creada, las imágenes
      // están en uso (el backend rechaza borrarlas) y el error es de otra cosa,
      // como la asignación a un módulo. La limpieza no tapa el error real.
      if (!creada) {
        await Promise.allSettled(subidas.map((c) => preguntasApi.borrarImagen(c)))
      }
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva pregunta"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={saving}>{saving ? 'Guardando...' : selectedModuleIds.size > 0 ? 'Crear y asignar' : 'Crear'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>}

        {/* Placeholder no funcional: detección de duplicados queda para un sprint futuro. */}
        <div className="border border-dashed border-slate-300 rounded px-3 py-2.5 text-slate-400 text-xs flex items-center gap-2">
          <span>🔍</span>
          <span>Detección de preguntas similares — próximamente</span>
        </div>

        <div>
          <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">Tipo</label>
          <select
            className={inputCls}
            value={form.tipo}
            onChange={(e) => handleTipoChange(e.target.value)}
          >
            <option value="VERDADERO_FALSO">Verdadero / Falso</option>
            <option value="OPCION_MULTIPLE">Opción múltiple</option>
            <option value="OPCIONES_IMAGEN">Opciones con imagen</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">Enunciado</label>
          <textarea
            rows={3}
            className={`${inputCls} resize-none`}
            value={form.texto}
            onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
            placeholder="Escribí la pregunta aquí..."
          />
        </div>

        <div>
          <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">
            Imagen del enunciado <span className="normal-case font-normal text-slate-400">(opcional)</span>
          </label>
          {imagenPreview ? (
            <div className="flex items-start gap-3">
              <img
                src={imagenPreview}
                alt="Imagen del enunciado"
                className="w-32 h-32 object-contain rounded border border-slate-200 bg-slate-50"
              />
              <div className="text-xs text-slate-500 space-y-1.5">
                <p className="font-mono break-all">{imagenFile.name}</p>
                <p>{(imagenFile.size / 1024).toFixed(0)} KB</p>
                <Button variant="secondary" onClick={() => setImagenFile(null)}>Quitar imagen</Button>
              </div>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept={IMAGEN_MIME_TYPES.join(',')}
                onChange={handleImagenChange}
                className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="text-slate-400 text-xs mt-1.5">
                PNG, JPG o WEBP · hasta {IMAGEN_MAX_BYTES / 1024 / 1024} MB. No se puede cambiar después de crear la pregunta.
              </p>
            </>
          )}
        </div>

        {necesitaOpciones && (
          <div className="space-y-2">
            <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest">
              {opcionesSonImagen ? 'Opciones (imágenes)' : 'Opciones'}
            </label>
            {opcionesSonImagen ? (
              <>
                <div className="grid grid-cols-4 gap-3">
                  {OPCION_LETRAS.map((letter, i) => (
                    <div key={letter} className="space-y-1.5">
                      <span className="text-slate-400 text-xs font-mono">{letter})</span>
                      {opcionPreviews[i] ? (
                        <div className="space-y-1.5">
                          <img
                            src={opcionPreviews[i]}
                            alt={`Opción ${letter.toUpperCase()}`}
                            className="w-full aspect-square object-contain rounded border border-slate-200 bg-slate-50"
                          />
                          <Button variant="secondary" size="sm" onClick={() => quitarOpcion(i)}>Quitar</Button>
                        </div>
                      ) : (
                        <label className="w-full aspect-square rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center cursor-pointer hover:border-slate-400 hover:bg-slate-100">
                          <span className="text-slate-400 text-xs">+ Imagen</span>
                          <input
                            type="file"
                            accept={IMAGEN_MIME_TYPES.join(',')}
                            onChange={(e) => handleOpcionChange(i, e)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-slate-400 text-xs">
                  Mínimo 2 · PNG, JPG o WEBP · hasta {IMAGEN_MAX_BYTES / 1024 / 1024} MB cada una.
                </p>
              </>
            ) : (
              OPCION_LETRAS.map((letter, i) => (
                <div key={letter} className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs font-mono w-4">{letter})</span>
                  <input
                    className="flex-1 bg-white border border-slate-300 rounded px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                    value={form.opciones[i]}
                    onChange={(e) => {
                      const opts = [...form.opciones]
                      opts[i] = e.target.value
                      setForm((f) => ({ ...f, opciones: opts }))
                    }}
                    placeholder={`Opción ${letter}`}
                  />
                </div>
              ))
            )}
          </div>
        )}

        <div>
          <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">Respuesta correcta</label>
          {form.tipo === 'VERDADERO_FALSO' ? (
            <select
              className={inputCls}
              value={form.respuestaCorrecta}
              onChange={(e) => setForm((f) => ({ ...f, respuestaCorrecta: e.target.value }))}
            >
              <option value="">Seleccioná...</option>
              <option value="Verdadero">Verdadero</option>
              <option value="Falso">Falso</option>
            </select>
          ) : opcionesSonImagen ? (
            // Un <select> no sirve acá: las opciones son imágenes y todavía no
            // tienen clave (se genera al subir), así que no hay texto que
            // mostrar. Se elige tocando la miniatura, como en la app del alumno.
            opcionFiles.some(Boolean) ? (
              <div className="grid grid-cols-4 gap-3">
                {opcionFiles.map((file, i) =>
                  file ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCorrectaFile(file)}
                      className={`w-full aspect-square rounded overflow-hidden border-2 transition-colors ${
                        correctaFile === file
                          ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <img src={opcionPreviews[i]} alt={`Opción ${OPCION_LETRAS[i].toUpperCase()}`} className="w-full h-full object-contain bg-slate-50" />
                    </button>
                  ) : null,
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-xs">Cargá las imágenes para elegir cuál es la correcta.</p>
            )
          ) : (
            <select
              className={inputCls}
              value={form.respuestaCorrecta}
              onChange={(e) => setForm((f) => ({ ...f, respuestaCorrecta: e.target.value }))}
            >
              <option value="">Seleccioná la opción correcta...</option>
              {form.opciones.filter(Boolean).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">
            Puntaje máximo <span className="normal-case font-normal text-slate-400">(opcional)</span>
          </label>
          <input
            type="number"
            className={inputCls}
            value={form.puntajeMax}
            onChange={(e) => setForm((f) => ({ ...f, puntajeMax: e.target.value }))}
            placeholder="10"
          />
        </div>

        <div>
          <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">
            Módulos <span className="normal-case font-normal text-slate-400">(opcional)</span>
          </label>
          <MultiSelectFilter
            options={moduleOptions}
            selectedIds={selectedModuleIds}
            onChange={setSelectedModuleIds}
            placeholder="Asignar a módulos..."
          />
        </div>
      </div>
    </Modal>
  )
}

// Modal "Editar módulos": edita a qué módulos está asignada una pregunta existente.
// NO edita el contenido de la pregunta (regla: las preguntas no se editan).
// Diff sobre la selección inicial (módulos activos):
//   - tildado sin pivot        → asignar (nuevo pivot)
//   - tildado con pivot inactivo → reactivar (setPreguntaActiva true; evita P2002)
//   - destildado antes activo  → baja lógica por módulo (setPreguntaActiva false)
// El padre solo la monta mientras está abierta (estado arranca limpio).
export function EditarModulosModal({ pregunta, onClose, onSaved }) {
  const [modules, setModules] = useState([])
  const asignaciones = pregunta.modulos ?? []
  const [selectedModuleIds, setSelectedModuleIds] = useState(
    () => new Set(asignaciones.filter((m) => m.activaEnModulo).map((m) => m.moduloId)),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    modulosApi.list().then(setModules).catch(() => {})
  }, [])

  const moduleOptions = useMemo(
    () => modules.map((m) => ({ id: m.id, label: m.nombre })),
    [modules],
  )

  // Estado del pivot por módulo: true/false = existe (activo/inactivo);
  // ausente = no hay pivot todavía.
  const existentes = useMemo(
    () => new Map(asignaciones.map((m) => [m.moduloId, m.activaEnModulo])),
    [asignaciones],
  )

  const handleGuardar = async () => {
    setSaving(true)
    setError(null)
    try {
      // Agregar / reactivar los tildados.
      for (const moduloId of selectedModuleIds) {
        const estado = existentes.get(moduloId)
        if (estado === undefined) {
          await modulosApi.asignarPreguntas(moduloId, [
            { preguntaId: pregunta.id, obligatoria: true },
          ])
        } else if (estado === false) {
          await modulosApi.setPreguntaActiva(moduloId, pregunta.id, true)
        }
      }
      // Quitar (baja lógica) los que estaban activos y ya no están tildados.
      for (const [moduloId, activa] of existentes) {
        if (activa && !selectedModuleIds.has(moduloId)) {
          await modulosApi.setPreguntaActiva(moduloId, pregunta.id, false)
        }
      }
      await onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Editar módulos de la pregunta"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>}

        <div>
          <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">Enunciado</label>
          <div className="flex items-start gap-2">
            {backendTypeBadge(pregunta.tipo)}
            <ImagenEnunciado imagen={pregunta.imagen} className="w-16 h-16" />
            <p className="text-slate-700 text-sm">{pregunta.texto}</p>
          </div>
        </div>

        <div>
          <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">Módulos</label>
          <ModulosPicker
            options={moduleOptions}
            selectedIds={selectedModuleIds}
            onChange={setSelectedModuleIds}
          />
        </div>
      </div>
    </Modal>
  )
}
