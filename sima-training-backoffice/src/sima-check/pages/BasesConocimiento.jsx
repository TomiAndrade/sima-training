import { useEffect, useState } from 'react'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { basesConocimientoApi } from '../../core/api/basesConocimiento'

// Taxonomía del banco de preguntas: cada base es un TEMA ("Gestión de
// residuos") y adentro tiene su propia escala ORDINAL de dificultad. La escala
// es por base a propósito — una puede necesitar 3 niveles y otra 5.
//
// No se usa <Table> porque cada fila se despliega para mostrar y editar su
// escala; el layout anidado no encaja en columnas (mismo motivo que
// ReglasAsignacion.jsx).

const inputCls =
  'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

const emptyForm = { nombre: '', codigo: '', descripcion: '', fuente: '', activa: true }

// Salto a la pantalla Preguntas con el filtro de clasificación ya puesto. El
// sub viaja etiquetado (`base/<id>` y opcionalmente `nivel/<id>`) y lo consume
// Questions.jsx al montar; ver filtroDeEntrada() allá.
//
// Es navegación y no un filtro compartido entre pantallas a propósito: Bases
// responde "qué temas hay y cómo están escalonados" y Preguntas "qué hay
// adentro". Sin esto, para ver las 63 del nivel Básico había que ir a
// Preguntas y volver a elegir base y nivel a mano en dos selects encadenados.
const irAPreguntas = (navigate, baseId, nivelId) =>
  navigate('questions', nivelId ? ['base', baseId, 'nivel', nivelId] : ['base', baseId])

export default function BasesConocimiento({ navigate }) {
  const [bases, setBases] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [abierta, setAbierta] = useState(null) // id de la base desplegada

  const [modal, setModal] = useState(null) // null | { mode: 'create'|'edit', data }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setBases(await basesConocimientoApi.list())
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    basesConocimientoApi
      .list()
      .then((data) => active && setBases(data))
      .catch((err) => active && setLoadError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setFormError(null)
    setModal({ mode: 'create' })
  }

  const openEdit = (base) => {
    setForm({
      nombre: base.nombre,
      codigo: base.codigo ?? '',
      descripcion: base.descripcion ?? '',
      fuente: base.fuente ?? '',
      activa: base.activa,
    })
    setFormError(null)
    setModal({ mode: 'edit', data: base })
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      setFormError('El nombre es obligatorio')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      // Los opcionales van como null cuando se vacían, para poder borrarlos.
      const payload = {
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim() || null,
        descripcion: form.descripcion.trim() || null,
        fuente: form.fuente.trim() || null,
        activa: form.activa,
      }
      if (modal.mode === 'create') {
        const creada = await basesConocimientoApi.create(payload)
        setAbierta(creada.id) // se abre sola para cargarle la escala
      } else {
        await basesConocimientoApi.update(modal.data.id, payload)
      }
      setModal(null)
      await loadData()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActiva = async (base) => {
    try {
      await basesConocimientoApi.update(base.id, { activa: !base.activa })
      await loadData()
    } catch (err) {
      window.alert(`No se pudo actualizar: ${err.message}`)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Bases de conocimiento</h2>
          <p className="text-slate-400 text-sm">
            {loading
              ? 'Cargando…'
              : `${bases.length} base${bases.length !== 1 ? 's' : ''} — el tema de cada pregunta y su escala de dificultad`}
          </p>
        </div>
        <Button onClick={openCreate} disabled={loading || !!loadError}>
          + Nueva base
        </Button>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between">
          <span>No se pudo conectar con la API: {loadError}</span>
          <Button variant="secondary" size="sm" onClick={loadData}>
            Reintentar
          </Button>
        </div>
      )}

      {!loadError && !loading && bases.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center">
          <p className="text-slate-500 text-sm">Todavía no hay bases de conocimiento cargadas.</p>
          <p className="text-slate-400 text-xs mt-1">
            Una base agrupa las preguntas por tema (ej. “Gestión de residuos”) y define su escala de dificultad.
          </p>
        </div>
      )}

      {!loadError && (
        <div className="space-y-3">
          {bases.map((base) => (
            <BaseCard
              key={base.id}
              base={base}
              abierta={abierta === base.id}
              onToggleAbierta={() => setAbierta(abierta === base.id ? null : base.id)}
              onEdit={() => openEdit(base)}
              onToggleActiva={() => toggleActiva(base)}
              onChanged={loadData}
              onVerPreguntas={(nivelId) => irAPreguntas(navigate, base.id, nivelId)}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Nueva base de conocimiento' : 'Editar base de conocimiento'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-700 text-sm font-medium mb-1">Nombre</label>
              <input
                className={inputCls}
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Gestión de residuos"
              />
            </div>
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1">
                Código <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                className={inputCls}
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="RES"
                maxLength={20}
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">Alcance</label>
            <textarea
              className={`${inputCls} h-20 resize-none`}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Qué entra y qué no en esta base"
            />
            <p className="text-slate-400 text-xs mt-1">
              Sirve para decidir sin dudar a cuál de dos bases parecidas va una pregunta nueva.
            </p>
          </div>
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">Fuente</label>
            <input
              className={inputCls}
              value={form.fuente}
              onChange={(e) => setForm((f) => ({ ...f, fuente: e.target.value }))}
              placeholder="Manual de Gestión de Residuos Rev. 4 — 03/2026"
            />
            <p className="text-slate-400 text-xs mt-1">
              De qué manual sale el temario <strong>hoy</strong>. Cada pregunta guarda la fuente
              vigente al momento de crearse, así que actualizar esto no reescribe las preguntas
              viejas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-slate-700 text-sm font-medium">Estado</label>
            <button
              onClick={() => setForm((f) => ({ ...f, activa: !f.activa }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.activa ? 'bg-red-600' : 'bg-slate-200'}`}
            >
              <span
                className={`absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.activa ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </button>
            <span className="text-slate-400 text-sm">{form.activa ? 'Activa' : 'Inactiva'}</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Fila colapsable: cabecera con los datos de la base, y adentro su escala.
function BaseCard({ base, abierta, onToggleAbierta, onEdit, onToggleActiva, onChanged, onVerPreguntas }) {
  const niveles = base.niveles ?? []
  const totalPreguntas = base._count?.preguntas ?? 0

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onToggleAbierta}
          className="text-slate-400 hover:text-slate-600 text-xs font-mono w-4 flex-shrink-0"
          aria-label={abierta ? 'Colapsar' : 'Expandir'}
        >
          {abierta ? '▼' : '▶'}
        </button>

        <button onClick={onToggleAbierta} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-900 font-semibold text-sm">{base.nombre}</span>
            {base.codigo && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-500">
                {base.codigo}
              </span>
            )}
            {!base.activa && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                Inactiva
              </span>
            )}
          </div>
          <div className="text-slate-400 text-xs mt-0.5">
            {niveles.length} nivel{niveles.length !== 1 ? 'es' : ''} · {totalPreguntas} pregunta
            {totalPreguntas !== 1 ? 's' : ''}
            {base.fuente && <span className="ml-2 text-slate-400">· {base.fuente}</span>}
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Va como Button aparte y no como link sobre el contador del
              subtítulo porque ese contador vive DENTRO del botón que despliega
              la base: un <button> anidado en otro es HTML inválido. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onVerPreguntas()}
            disabled={totalPreguntas === 0}
            title={totalPreguntas === 0 ? 'Esta base todavía no tiene preguntas' : 'Ver estas preguntas en el banco'}
          >
            Ver preguntas
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Editar
          </Button>
          <Button variant={base.activa ? 'danger' : 'secondary'} size="sm" onClick={onToggleActiva}>
            {base.activa ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      </div>

      {abierta && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
          {base.descripcion && (
            <p className="text-slate-500 text-xs mb-3 max-w-3xl">{base.descripcion}</p>
          )}
          <EscalaNiveles base={base} onChanged={onChanged} onVerPreguntas={onVerPreguntas} />
        </div>
      )}
    </div>
  )
}

// Escala de dificultad de una base. Reordenar manda SIEMPRE la lista completa:
// el backend reindexa todo de una porque el índice único (base, orden) no
// tolera movimientos parciales.
function EscalaNiveles({ base, onChanged, onVerPreguntas }) {
  const [nuevo, setNuevo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null) // { id, nombre }

  const niveles = base.niveles ?? []

  const run = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const agregar = () => {
    if (!nuevo.trim()) return
    run(async () => {
      await basesConocimientoApi.crearNivel(base.id, { nombre: nuevo.trim() })
      setNuevo('')
    })
  }

  const mover = (index, delta) => {
    const destino = index + delta
    if (destino < 0 || destino >= niveles.length) return
    const ids = niveles.map((n) => n.id)
    ;[ids[index], ids[destino]] = [ids[destino], ids[index]]
    run(() => basesConocimientoApi.reordenarNiveles(base.id, ids))
  }

  const guardarNombre = () => {
    if (!editando?.nombre.trim()) return
    run(async () => {
      await basesConocimientoApi.actualizarNivel(base.id, editando.id, {
        nombre: editando.nombre.trim(),
      })
      setEditando(null)
    })
  }

  const eliminar = (nivel) => {
    const usadas = nivel._count?.preguntas ?? 0
    if (usadas > 0) {
      window.alert(
        `“${nivel.nombre}” tiene ${usadas} pregunta(s) asignada(s). Reclasificalas antes de eliminarlo.`,
      )
      return
    }
    if (!window.confirm(`¿Eliminar el nivel “${nivel.nombre}”?`)) return
    run(() => basesConocimientoApi.eliminarNivel(base.id, nivel.id))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-widest">
          Escala de dificultad
        </span>
        <span className="text-slate-400 text-xs">de menor a mayor</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
          {error}
        </div>
      )}

      {niveles.length === 0 && (
        <p className="text-slate-400 text-xs py-2">
          Sin niveles. Agregá al menos uno para poder clasificar preguntas por dificultad.
        </p>
      )}

      <div className="space-y-1">
        {niveles.map((nivel, i) => (
          <div
            key={nivel.id}
            className="flex items-center gap-2 bg-white border border-slate-200 rounded px-3 py-2"
          >
            <span className="text-slate-400 text-xs font-mono w-5 flex-shrink-0">{i + 1}</span>

            {editando?.id === nivel.id ? (
              <>
                <input
                  className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                  value={editando.nombre}
                  autoFocus
                  onChange={(e) => setEditando((s) => ({ ...s, nombre: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && guardarNombre()}
                />
                <Button size="sm" onClick={guardarNombre} disabled={busy}>
                  Guardar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditando(null)} disabled={busy}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-slate-800 text-sm">{nivel.nombre}</span>
                {/* El contador ES el link: es lo que el ojo ya está mirando
                    para saber cuántas hay, así que sumarle un botón "Ver" al
                    lado sería un control de más para la misma pregunta. Con
                    cero preguntas queda como texto plano — un link que lleva a
                    una lista vacía es sólo una decepción. */}
                {(nivel._count?.preguntas ?? 0) > 0 ? (
                  <button
                    type="button"
                    onClick={() => onVerPreguntas(nivel.id)}
                    title={`Ver las preguntas de ${base.nombre} · ${nivel.nombre} en el banco`}
                    className="text-slate-500 hover:text-red-600 text-xs underline decoration-dotted underline-offset-2 transition-colors"
                  >
                    {nivel._count.preguntas} pregunta{nivel._count.preguntas !== 1 ? 's' : ''}
                  </button>
                ) : (
                  <span className="text-slate-400 text-xs">0 preguntas</span>
                )}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => mover(i, -1)}
                    disabled={busy || i === 0}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:hover:text-slate-400 text-xs px-1"
                    title="Subir"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => mover(i, 1)}
                    disabled={busy || i === niveles.length - 1}
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:hover:text-slate-400 text-xs px-1"
                    title="Bajar"
                  >
                    ▼
                  </button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditando({ id: nivel.id, nombre: nivel.nombre })}
                  disabled={busy}
                >
                  Renombrar
                </Button>
                <Button variant="danger" size="sm" onClick={() => eliminar(nivel)} disabled={busy}>
                  Eliminar
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
          placeholder="Nuevo nivel (ej. Básico)"
        />
        <Button size="sm" onClick={agregar} disabled={busy || !nuevo.trim()}>
          Agregar nivel
        </Button>
      </div>
    </div>
  )
}
