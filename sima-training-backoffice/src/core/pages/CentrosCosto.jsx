import { useEffect, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { centrosCostoApi } from '../api/centrosCosto'

const emptyForm = { nombre: '', activo: true }

export default function CentrosCosto() {
  const [centrosCosto, setCentrosCosto] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [modal, setModal] = useState(null) // null | { mode: 'create'|'edit', data }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setCentrosCosto(await centrosCostoApi.list())
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    centrosCostoApi.list()
      .then((data) => active && setCentrosCosto(data))
      .catch((err) => active && setLoadError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setFormError(null)
    setModal({ mode: 'create' })
  }

  const openEdit = (centroCosto) => {
    setForm({ nombre: centroCosto.nombre, activo: centroCosto.activo })
    setFormError(null)
    setModal({ mode: 'edit', data: centroCosto })
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      setFormError('El nombre es obligatorio')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload = { nombre: form.nombre.trim(), activo: form.activo }
      if (modal.mode === 'create') {
        await centrosCostoApi.create(payload)
      } else {
        await centrosCostoApi.update(modal.data.id, payload)
      }
      setModal(null)
      await loadData()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (centroCosto) => {
    try {
      await centrosCostoApi.update(centroCosto.id, { activo: !centroCosto.activo })
      await loadData()
    } catch (err) {
      window.alert(`No se pudo actualizar: ${err.message}`)
    }
  }

  const columns = [
    { key: 'nombre', label: 'Nombre' },
    {
      key: 'activo',
      label: 'Estado',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${val ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
          {val ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Centros de Costo</h2>
          <p className="text-slate-400 text-sm">
            {loading ? 'Cargando…' : `${centrosCosto.length} centro${centrosCosto.length !== 1 ? 's' : ''} de costo registrados`}
          </p>
        </div>
        <Button onClick={openCreate} disabled={loading || !!loadError}>+ Nuevo centro de costo</Button>
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
          data={centrosCosto}
          actions={(row) => (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>Editar</Button>
              <Button variant={row.activo ? 'danger' : 'secondary'} size="sm" onClick={() => toggleActivo(row)}>
                {row.activo ? 'Desactivar' : 'Activar'}
              </Button>
            </>
          )}
        />
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Nuevo centro de costo' : 'Editar centro de costo'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} disabled={saving}>Cancelar</Button>
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
            <label className="block text-slate-700 text-sm font-medium mb-1">Nombre</label>
            <input
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre del centro de costo"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-slate-700 text-sm font-medium">Estado</label>
            <button
              onClick={() => setForm((f) => ({ ...f, activo: !f.activo }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.activo ? 'bg-red-600' : 'bg-slate-200'}`}
            >
              <span className={`absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.activo ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-slate-400 text-sm">{form.activo ? 'Activo' : 'Inactivo'}</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}
