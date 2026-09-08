import { useEffect, useMemo, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { organizacionesApi } from '../api/organizaciones'
import { normalizarTexto } from '../format/texto'
import { tipoOrganizacionBadge } from '../format/badges'

const TIPO_LABEL = { CLIENTE: 'Cliente', SUBCONTRATISTA: 'Subcontratista', INTERNA: 'Interna' }

// El ABM sólo deja crear/pasar entre CLIENTE y SUBCONTRATISTA. INTERNA existe
// una sola vez ("Ingeniería SIMA") y se maneja aparte (ver crear-admin.ts en
// el backend) — ofrecerla acá invitaría a crear una segunda por error.
const TIPOS_SELECCIONABLES = ['CLIENTE', 'SUBCONTRATISTA']

const emptyForm = { nombre: '', tipo: 'CLIENTE', organizacionPadreId: '', activa: true }

export default function Organizaciones() {
  const [organizaciones, setOrganizaciones] = useState([])
  const [search, setSearch] = useState('')
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
      setOrganizaciones(await organizacionesApi.list())
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    organizacionesApi.list()
      .then((data) => active && setOrganizaciones(data))
      .catch((err) => active && setLoadError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  // Nombre de la organización padre, resuelto en memoria contra el catálogo
  // ya cargado — no hay un segundo request por fila.
  const nombrePorId = useMemo(() => {
    const m = new Map()
    organizaciones.forEach((o) => m.set(o.id, o.nombre))
    return m
  }, [organizaciones])

  // Candidatas a padre de un SUBCONTRATISTA: sólo CLIENTE activos, y nunca la
  // organización que se está editando (el backend ya rechaza la auto-referencia
  // directa, esto es sólo para no ofrecerla en el select).
  const clientesDisponibles = useMemo(() => {
    return organizaciones.filter((o) => o.tipo === 'CLIENTE' && o.activa && o.id !== modal?.data?.id)
  }, [organizaciones, modal])

  const openCreate = () => {
    setForm(emptyForm)
    setFormError(null)
    setModal({ mode: 'create' })
  }

  const openEdit = (org) => {
    setForm({
      nombre: org.nombre,
      tipo: org.tipo,
      organizacionPadreId: org.organizacionPadreId ?? '',
      activa: org.activa,
    })
    setFormError(null)
    setModal({ mode: 'edit', data: org })
  }

  const esInterna = modal?.mode === 'edit' && modal.data.tipo === 'INTERNA'

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      setFormError('El nombre es obligatorio')
      return
    }
    if (form.tipo === 'SUBCONTRATISTA' && !form.organizacionPadreId) {
      setFormError('Elegí la organización cliente de la que depende este subcontratista')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        tipo: esInterna ? 'INTERNA' : form.tipo,
        organizacionPadreId: form.tipo === 'SUBCONTRATISTA' ? Number(form.organizacionPadreId) : null,
        activa: form.activa,
      }
      if (modal.mode === 'create') {
        await organizacionesApi.create(payload)
      } else {
        await organizacionesApi.update(modal.data.id, payload)
      }
      setModal(null)
      await loadData()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActiva = async (org) => {
    try {
      await organizacionesApi.update(org.id, { activa: !org.activa })
      await loadData()
    } catch (err) {
      window.alert(`No se pudo actualizar: ${err.message}`)
    }
  }

  // Mismo criterio que Puestos/CentrosCosto: filtra en memoria porque
  // GET /organizaciones no acepta ningún ?q= y el catálogo ya está cargado
  // entero igual.
  const visibles = useMemo(() => {
    const q = normalizarTexto(search)
    if (!q) return organizaciones
    return organizaciones.filter((o) => normalizarTexto(o.nombre).includes(q))
  }, [organizaciones, search])

  const filtrando = normalizarTexto(search) !== ''

  const columns = [
    { key: 'nombre', label: 'Nombre' },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tipoOrganizacionBadge[val] ?? 'bg-slate-100 text-slate-500'}`}>
          {TIPO_LABEL[val] ?? val}
        </span>
      ),
    },
    {
      key: 'organizacionPadreId',
      label: 'Organización padre',
      render: (val) => (
        <span className={val ? 'text-slate-700' : 'text-slate-400'}>
          {val ? (nombrePorId.get(val) ?? '—') : '—'}
        </span>
      ),
    },
    {
      key: 'activa',
      label: 'Estado',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${val ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
          {val ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Organizaciones</h2>
          <p className="text-slate-400 text-sm">
            {loading
              ? 'Cargando…'
              : filtrando
                ? `${visibles.length} de ${organizaciones.length} organización${organizaciones.length !== 1 ? 'es' : ''}`
                : `${organizaciones.length} organización${organizaciones.length !== 1 ? 'es' : ''} registrada${organizaciones.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={openCreate} disabled={loading || !!loadError}>+ Nueva organización</Button>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between">
          <span>No se pudo conectar con la API: {loadError}</span>
          <Button variant="secondary" size="sm" onClick={loadData}>Reintentar</Button>
        </div>
      )}

      {!loadError && (
        <div className="flex items-center gap-2">
          <input
            className="bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600 min-w-[280px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar organización..."
          />
          {filtrando && (
            <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
              Limpiar
            </Button>
          )}
        </div>
      )}

      {!loadError && (
        <Table
          columns={columns}
          data={visibles}
          actions={(row) => (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>Editar</Button>
              <Button variant={row.activa ? 'danger' : 'secondary'} size="sm" onClick={() => toggleActiva(row)}>
                {row.activa ? 'Desactivar' : 'Activar'}
              </Button>
            </>
          )}
        />
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Nueva organización' : 'Editar organización'}
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
              placeholder="Nombre de la organización"
            />
          </div>

          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">Tipo</label>
            {esInterna ? (
              <p className="text-slate-400 text-sm">
                Interna — no se puede cambiar desde acá.
              </p>
            ) : (
              <select
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value, organizacionPadreId: '' }))}
              >
                {TIPOS_SELECCIONABLES.map((t) => (
                  <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                ))}
              </select>
            )}
          </div>

          {!esInterna && form.tipo === 'SUBCONTRATISTA' && (
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1">Organización cliente</label>
              {clientesDisponibles.length === 0 ? (
                <p className="text-amber-600 text-sm">
                  No hay ninguna organización de tipo Cliente activa todavía — creá una primero.
                </p>
              ) : (
                <select
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                  value={form.organizacionPadreId}
                  onChange={(e) => setForm((f) => ({ ...f, organizacionPadreId: e.target.value }))}
                >
                  <option value="">— Elegir cliente —</option>
                  {clientesDisponibles.map((o) => (
                    <option key={o.id} value={o.id}>{o.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="text-slate-700 text-sm font-medium">Estado</label>
            <button
              onClick={() => setForm((f) => ({ ...f, activa: !f.activa }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.activa ? 'bg-red-600' : 'bg-slate-200'}`}
            >
              <span className={`absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.activa ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-slate-400 text-sm">{form.activa ? 'Activa' : 'Inactiva'}</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}
