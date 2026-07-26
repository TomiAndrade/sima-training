import { useEffect, useMemo, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { reglasAsignacionApi } from '../api/reglasAsignacion'
import { puestosApi } from '../api/puestos'
import { centrosCostoApi } from '../api/centrosCosto'
import { modulosApi } from '../api/modulos'

const emptyForm = { puestoId: '', centroCostoId: '', moduloId: '' }

export default function ReglasAsignacion() {
  const [reglas, setReglas] = useState([])
  const [puestos, setPuestos] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])
  const [modulos, setModulos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const fetchAll = async () => {
    const [regs, pue, centros, mods] = await Promise.all([
      reglasAsignacionApi.list(),
      puestosApi.list(),
      centrosCostoApi.list(),
      modulosApi.list(),
    ])
    setReglas(regs)
    setPuestos(pue)
    setCentrosCosto(centros)
    setModulos(mods)
  }

  const loadData = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      await fetchAll()
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()
      .catch((err) => active && setLoadError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  // Ninguno de los tres catálogos soporta `?activo=` en el listado (ver
  // core/pages/Usuarios.jsx), así que se filtra a activos en el cliente.
  const puestosActivos = useMemo(() => puestos.filter((p) => p.activo), [puestos])
  const centrosActivos = useMemo(() => centrosCosto.filter((c) => c.activo), [centrosCosto])
  const modulosActivos = useMemo(() => modulos.filter((m) => m.activo), [modulos])

  const puestoNombre = useMemo(() => new Map(puestos.map((p) => [p.id, p.nombre])), [puestos])
  const centroNombre = useMemo(() => new Map(centrosCosto.map((c) => [c.id, c.nombre])), [centrosCosto])
  const moduloPorId = useMemo(() => new Map(modulos.map((m) => [m.id, m])), [modulos])

  const openCreate = () => {
    setForm({
      puestoId: puestosActivos[0]?.id ?? '',
      centroCostoId: centrosActivos[0]?.id ?? '',
      moduloId: modulosActivos[0]?.id ?? '',
    })
    setFormError(null)
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.puestoId || !form.centroCostoId || !form.moduloId) {
      setFormError('Elegí puesto, centro de costo y módulo')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await reglasAsignacionApi.create(form)
      setModal(false)
      await loadData()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (regla) => {
    try {
      await reglasAsignacionApi.setActivo(regla.id, !regla.activo)
      await loadData()
    } catch (err) {
      window.alert(`No se pudo actualizar: ${err.message}`)
    }
  }

  const moduloLabel = (m) => {
    if (!m) return '—'
    const sinVersionActiva = !m.vigente || m.vigente.estado !== 'ACTIVO'
    return sinVersionActiva ? `${m.nombre} (sin versión publicada)` : m.nombre
  }

  const columns = [
    { key: 'puestoId', label: 'Puesto', render: (id) => puestoNombre.get(id) ?? '—' },
    { key: 'centroCostoId', label: 'Centro de costo', render: (id) => centroNombre.get(id) ?? '—' },
    { key: 'moduloId', label: 'Módulo', render: (id) => moduloLabel(moduloPorId.get(id)) },
    {
      key: 'activo',
      label: 'Estado',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${val ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
          {val ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
  ]

  const selectCls = 'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Reglas de asignación</h2>
          <p className="text-slate-400 text-sm">
            {loading ? 'Cargando…' : `${reglas.length} regla${reglas.length !== 1 ? 's' : ''} registradas`}
          </p>
        </div>
        <Button onClick={openCreate} disabled={loading || !!loadError}>+ Nueva regla</Button>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between">
          <span>No se pudo conectar con la API: {loadError}</span>
          <Button variant="secondary" size="sm" onClick={loadData}>Reintentar</Button>
        </div>
      )}

      {!loadError && (
        <Table
          columns={columns}
          data={reglas}
          actions={(row) => (
            <Button variant={row.activo ? 'danger' : 'secondary'} size="sm" onClick={() => toggleActivo(row)}>
              {row.activo ? 'Desactivar' : 'Activar'}
            </Button>
          )}
        />
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Nueva regla"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">Puesto</label>
            <select
              className={selectCls}
              value={form.puestoId}
              onChange={(e) => setForm((f) => ({ ...f, puestoId: e.target.value }))}
            >
              {puestosActivos.length === 0 && <option value="">— Sin puestos activos —</option>}
              {puestosActivos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">Centro de costo</label>
            <select
              className={selectCls}
              value={form.centroCostoId}
              onChange={(e) => setForm((f) => ({ ...f, centroCostoId: e.target.value }))}
            >
              {centrosActivos.length === 0 && <option value="">— Sin centros activos —</option>}
              {centrosActivos.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">Módulo</label>
            <select
              className={selectCls}
              value={form.moduloId}
              onChange={(e) => setForm((f) => ({ ...f, moduloId: e.target.value }))}
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
