import { useEffect, useMemo, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { usuariosApi } from '../../core/api/usuarios'
import { asignacionesApi } from '../../core/api/asignaciones'
import { reglasAsignacionApi } from '../../core/api/reglasAsignacion'
import { modulosApi } from '../../core/api/modulos'

const roleBadge = {
  ADMINISTRADOR: 'bg-red-50 text-red-600',
  COORDINADOR: 'bg-blue-50 text-blue-600',
  AUDITOR: 'bg-violet-50 text-violet-600',
  ALUMNO: 'bg-emerald-50 text-emerald-600',
}

const origenBadge = {
  AUTOMATICA: 'bg-indigo-50 text-indigo-600',
  MANUAL: 'bg-slate-100 text-slate-600',
}

// Mismo criterio que ReglasAsignacion.jsx: un módulo sin versión ACTIVO
// publicada no está disponible para rendir todavía.
function moduloLabel(m) {
  if (!m) return '—'
  const sinVersionActiva = !m.vigente || m.vigente.estado !== 'ACTIVO'
  return sinVersionActiva ? `${m.nombre} (sin versión publicada)` : m.nombre
}

// No hay endpoint que devuelva "por qué" se generó una asignación puntual, así
// que se deriva en el cliente reimplementando el mismo matching que
// AsignacionesService.recalcular() en el backend: por par exacto (puesto +
// centro) o por regla de centro (puestoId null, aplica a todos los puestos del
// centro). Si no aparece ninguna regla activa que la explique, se muestra como
// desconocida en vez de inventar — puede pasar si la regla se desactivó y
// todavía no se recalculó.
function explicarAutomatica(asignacion, paresActivos, reglasActivas) {
  const candidatas = reglasActivas.filter((r) => r.moduloId === asignacion.moduloId)
  for (const par of paresActivos) {
    const porPar = candidatas.find(
      (r) => r.puestoId === par.puesto.id && r.centroCostoId === par.centroCosto.id,
    )
    if (porPar) return { tipo: 'PUESTO', par }
    const porCentro = candidatas.find((r) => r.puestoId == null && r.centroCostoId === par.centroCosto.id)
    if (porCentro) return { tipo: 'CENTRO', par }
  }
  return null
}

export default function TrainingAssignments() {
  const [usuarios, setUsuarios] = useState([])
  const [reglas, setReglas] = useState([])
  const [modulos, setModulos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [query, setQuery] = useState('')
  const [selectedUsuario, setSelectedUsuario] = useState(null)

  const [asignaciones, setAsignaciones] = useState([])
  const [asignacionesLoading, setAsignacionesLoading] = useState(false)
  const [asignacionesError, setAsignacionesError] = useState(null)

  const [showRevocadas, setShowRevocadas] = useState(false)
  const [recalculando, setRecalculando] = useState(false)
  const [recalcResult, setRecalcResult] = useState(null)

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ moduloId: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const fetchCatalogos = async () => {
    const [us, regs, mods] = await Promise.all([
      usuariosApi.list(),
      reglasAsignacionApi.list({ activo: true }),
      modulosApi.list(),
    ])
    setUsuarios(us)
    setReglas(regs)
    setModulos(mods)
  }

  const loadCatalogos = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      await fetchCatalogos()
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCatalogos()
      .catch((err) => active && setLoadError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const moduloPorId = useMemo(() => new Map(modulos.map((m) => [m.id, m])), [modulos])

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return usuarios
      .filter((u) => u.dni.toLowerCase().includes(q) || `${u.nombre} ${u.apellido}`.toLowerCase().includes(q))
      .slice(0, 20)
  }, [usuarios, query])

  const paresActivos = useMemo(
    () => (selectedUsuario?.vinculacion?.pares ?? []).filter((p) => p.activo),
    [selectedUsuario],
  )

  const loadAsignaciones = async (usuarioId) => {
    setAsignacionesLoading(true)
    setAsignacionesError(null)
    try {
      const data = await asignacionesApi.list(usuarioId)
      setAsignaciones(data)
    } catch (err) {
      setAsignacionesError(err.message)
    } finally {
      setAsignacionesLoading(false)
    }
  }

  const handleSelect = (usuario) => {
    setSelectedUsuario(usuario)
    setQuery('')
    setShowRevocadas(false)
    setRecalcResult(null)
    loadAsignaciones(usuario.id)
  }

  const handleCambiarPersona = () => {
    setSelectedUsuario(null)
    setAsignaciones([])
  }

  const handleRecalcular = async () => {
    setRecalculando(true)
    setRecalcResult(null)
    try {
      const result = await asignacionesApi.recalcular(selectedUsuario.id)
      setRecalcResult(result)
      await loadAsignaciones(selectedUsuario.id)
    } catch (err) {
      window.alert(`No se pudo recalcular: ${err.message}`)
    } finally {
      setRecalculando(false)
    }
  }

  const handleRevocar = async (asignacion) => {
    const nombreModulo = moduloPorId.get(asignacion.moduloId)?.nombre ?? 'este módulo'
    const ok = window.confirm(`¿Revocar la asignación de "${nombreModulo}"? No se puede deshacer.`)
    if (!ok) return
    try {
      await asignacionesApi.revocar(asignacion.id)
      await loadAsignaciones(selectedUsuario.id)
    } catch (err) {
      window.alert(`No se pudo revocar: ${err.message}`)
    }
  }

  const modulosActivos = useMemo(() => modulos.filter((m) => m.activo), [modulos])

  const openManualModal = () => {
    setForm({ moduloId: modulosActivos[0]?.id ?? '' })
    setFormError(null)
    setModal(true)
  }

  const handleManualSave = async () => {
    if (!form.moduloId) {
      setFormError('Elegí un módulo')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await asignacionesApi.create({ usuarioId: selectedUsuario.id, moduloId: form.moduloId })
      setModal(false)
      await loadAsignaciones(selectedUsuario.id)
    } catch (err) {
      setFormError(
        err.message.includes('vigente')
          ? 'Esta persona ya tiene una asignación vigente de ese módulo.'
          : err.message,
      )
    } finally {
      setSaving(false)
    }
  }

  const vigentes = useMemo(() => asignaciones.filter((a) => !a.revocadaAt), [asignaciones])
  const revocadas = useMemo(() => asignaciones.filter((a) => a.revocadaAt), [asignaciones])

  const origenLabel = (val) => (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${origenBadge[val] ?? 'bg-slate-100 text-slate-500'}`}>
      {val === 'AUTOMATICA' ? 'Automática' : 'Manual'}
    </span>
  )

  const vigentesColumns = [
    {
      key: 'moduloId',
      label: 'Módulo',
      render: (id) => <span className="text-slate-900 font-medium">{moduloLabel(moduloPorId.get(id))}</span>,
    },
    { key: 'origen', label: 'Origen', render: origenLabel },
    {
      key: '_explicacion',
      label: 'Por qué',
      render: (_, row) => {
        if (row.origen !== 'AUTOMATICA') {
          return <span className="text-slate-400 text-sm">Cargada a mano</span>
        }
        const exp = explicarAutomatica(row, paresActivos, reglas)
        if (!exp) return <span className="text-amber-600 text-sm">Regla desconocida</span>
        return exp.tipo === 'PUESTO' ? (
          <span className="text-slate-500 text-sm">por {exp.par.puesto.nombre} en {exp.par.centroCosto.nombre}</span>
        ) : (
          <span className="text-slate-500 text-sm">por todo el centro {exp.par.centroCosto.nombre}</span>
        )
      },
    },
  ]

  const revocadasColumns = [
    {
      key: 'moduloId',
      label: 'Módulo',
      render: (id) => <span className="text-slate-700">{moduloLabel(moduloPorId.get(id))}</span>,
    },
    { key: 'origen', label: 'Origen', render: origenLabel },
    {
      key: 'revocadaAt',
      label: 'Revocada el',
      render: (val) => <span className="text-slate-500 text-sm">{new Date(val).toLocaleDateString('es-AR')}</span>,
    },
  ]

  const selectCls = 'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-slate-900 font-bold text-xl">Asignaciones</h2>
        <p className="text-slate-400 text-sm">
          Qué le corresponde rendir a cada persona, y por qué. Las asignaciones automáticas las deriva el motor a
          partir de las reglas y los pares de puesto/centro de costo.
        </p>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between">
          <span>No se pudo conectar con la API: {loadError}</span>
          <Button variant="secondary" size="sm" onClick={loadCatalogos}>Reintentar</Button>
        </div>
      )}

      {!loadError && !selectedUsuario && (
        <div className="space-y-3">
          <input
            type="text"
            autoFocus
            disabled={loading}
            placeholder="Buscar persona por nombre o DNI…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-md bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-red-600"
          />
          {loading ? (
            <p className="text-slate-400 text-sm">Cargando…</p>
          ) : query.trim() === '' ? (
            <p className="text-slate-400 text-sm">Buscá una persona para ver sus asignaciones vigentes y revocadas.</p>
          ) : (
            <div className="border border-slate-200 rounded overflow-hidden max-h-80 overflow-y-auto bg-white">
              {resultados.length === 0 ? (
                <div className="px-3 py-4 text-slate-400 text-sm text-center">Sin resultados</div>
              ) : (
                resultados.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelect(u)}
                    className="w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-medium text-slate-900">{u.nombre} {u.apellido}</span>
                    <div className="flex items-center gap-3 text-slate-400">
                      <span className="font-mono text-xs">{u.dni}</span>
                      <span className="text-xs">{u.vinculacion?.organizacion?.nombre ?? '—'}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {selectedUsuario && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-slate-900 font-semibold text-lg">
                    {selectedUsuario.nombre} {selectedUsuario.apellido}
                  </h3>
                  {selectedUsuario.vinculacion?.rol && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${roleBadge[selectedUsuario.vinculacion.rol] ?? 'bg-slate-100 text-slate-600'}`}>
                      {selectedUsuario.vinculacion.rol.toLowerCase()}
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-sm font-mono">{selectedUsuario.dni}</p>
                <p className="text-slate-500 text-sm">{selectedUsuario.vinculacion?.organizacion?.nombre ?? '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleCambiarPersona}>Cambiar persona</Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRecalcular}
                  disabled={recalculando}
                  title="Recalcula las automáticas contra las reglas vigentes. Solo hace falta si cambiaron las reglas — editar los pares de la persona ya recalcula solo."
                >
                  {recalculando ? 'Recalculando…' : 'Recalcular'}
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                Puestos y centros de costo activos
              </p>
              {paresActivos.length === 0 ? (
                <p className="text-slate-400 text-sm">
                  Sin pares activos — no le corresponde ninguna capacitación automática.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {paresActivos.map((par, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      {par.puesto.nombre} · {par.centroCosto.nombre}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {recalcResult && (
              <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm rounded px-3 py-2">
                Recalculado: {recalcResult.creadas} nueva{recalcResult.creadas === 1 ? '' : 's'} · {recalcResult.revocadas} revocada{recalcResult.revocadas === 1 ? '' : 's'}
              </div>
            )}
          </div>

          {asignacionesError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between">
              <span>No se pudieron cargar las asignaciones: {asignacionesError}</span>
              <Button variant="secondary" size="sm" onClick={() => loadAsignaciones(selectedUsuario.id)}>Reintentar</Button>
            </div>
          )}

          {!asignacionesError && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-slate-700 font-semibold text-sm">
                    Vigentes {!asignacionesLoading && `(${vigentes.length})`}
                  </h4>
                  <Button size="sm" onClick={openManualModal}>+ Asignar manual</Button>
                </div>
                {asignacionesLoading ? (
                  <p className="text-slate-400 text-sm">Cargando…</p>
                ) : (
                  <Table
                    columns={vigentesColumns}
                    data={vigentes}
                    actions={(row) => (
                      <Button variant="danger" size="sm" onClick={() => handleRevocar(row)}>Revocar</Button>
                    )}
                  />
                )}
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowRevocadas((v) => !v)}
                  className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <span className="text-xs">{showRevocadas ? '▾' : '▸'}</span>
                  Revocadas ({revocadas.length})
                </button>
                {showRevocadas && <Table columns={revocadasColumns} data={revocadas} />}
              </div>
            </>
          )}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Asignar módulo manualmente"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleManualSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-slate-500 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2">
            Una asignación manual no la maneja el motor automático: no se revoca sola si ningún par de la persona la
            pide. Para deshacerla hay que revocarla a mano.
          </p>
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">{formError}</div>
          )}
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">Módulo</label>
            <select
              className={selectCls}
              value={form.moduloId}
              onChange={(e) => { setForm({ moduloId: e.target.value }); setFormError(null) }}
            >
              {modulosActivos.length === 0 && <option value="">— Sin módulos activos —</option>}
              {modulosActivos.map((m) => (
                <option key={m.id} value={m.id}>{moduloLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
