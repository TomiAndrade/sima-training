import { useEffect, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { usuariosApi } from '../api/usuarios'
import { organizacionesApi } from '../api/organizaciones'
import ImportUsuariosModal from '../components/ImportUsuariosModal'

const ROLES = ['ADMINISTRADOR', 'COORDINADOR']

const roleBadge = {
  ADMINISTRADOR: 'bg-red-50 text-red-600',
  COORDINADOR: 'bg-blue-50 text-blue-600',
}

const TABS = [
  { id: 'sima',    label: 'SIMA' },
  { id: 'clientes', label: 'Clientes' },
]

const emptyForm = {
  nombre: '',
  apellido: '',
  dni: '',
  email: '',
  rol: 'COORDINADOR',
  organizacionId: '',
}

export default function Users() {
  const [usuarios, setUsuarios] = useState([])
  const [organizaciones, setOrganizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [tab, setTab] = useState('sima')

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

  const fetchAll = async () => {
    const [us, orgs] = await Promise.all([
      usuariosApi.list(),
      organizacionesApi.list(),
    ])
    setUsuarios(us)
    setOrganizaciones(orgs)
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

  // Un usuario es "SIMA" si pertenece a una org de tipo INTERNA.
  const isSima = (usuario) => {
    const org = organizaciones.find((o) => o.id === usuario.organizacionId)
    return org?.tipo === 'INTERNA'
  }

  const usuariosFiltrados = usuarios.filter((u) =>
    tab === 'sima' ? isSima(u) : !isSima(u),
  )

  const getOrgName = (id) =>
    organizaciones.find((o) => o.id === id)?.nombre ?? '—'

  // Organizaciones disponibles según la tab activa para el select del form.
  const orgsParaTab = organizaciones.filter((o) =>
    tab === 'sima' ? o.tipo === 'INTERNA' : o.tipo !== 'INTERNA',
  )

  const openCreate = () => {
    const defaultOrg = orgsParaTab[0]?.id ?? ''
    setForm({ ...emptyForm, organizacionId: defaultOrg })
    setFormError(null)
    setModal({ mode: 'create' })
  }

  const openEdit = (user) => {
    setForm({
      nombre: user.nombre ?? '',
      apellido: user.apellido ?? '',
      dni: user.dni ?? '',
      email: user.email ?? '',
      rol: user.rol ?? 'COORDINADOR',
      organizacionId: user.organizacionId ?? '',
    })
    setFormError(null)
    setModal({ mode: 'edit', data: user })
  }

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.dni.trim()) {
      setFormError('Nombre, apellido y DNI son obligatorios')
      return
    }
    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      dni: form.dni.trim(),
      rol: form.rol,
      organizacionId: form.organizacionId ? Number(form.organizacionId) : undefined,
    }
    if (form.email.trim()) payload.email = form.email.trim()

    setSaving(true)
    setFormError(null)
    try {
      if (modal.mode === 'create') {
        await usuariosApi.create(payload)
      } else {
        await usuariosApi.update(modal.data.id, payload)
      }
      setModal(null)
      await loadData()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user) => {
    const ok = window.confirm(
      `¿Dar de baja a ${user.nombre} ${user.apellido}? Esta acción se puede revertir desde la base.`,
    )
    if (!ok) return
    try {
      await usuariosApi.remove(user.id)
      await loadData()
    } catch (err) {
      window.alert(`No se pudo dar de baja: ${err.message}`)
    }
  }

  const columns = [
    {
      key: 'nombre',
      label: 'Nombre',
      render: (_, row) => `${row.nombre} ${row.apellido}`,
    },
    { key: 'dni', label: 'DNI', render: (val) => <span className="font-mono">{val}</span> },
    {
      key: 'rol',
      label: 'Rol',
      render: (val) => (
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${roleBadge[val] ?? 'bg-slate-100 text-slate-600'}`}
        >
          {val?.toLowerCase()}
        </span>
      ),
    },
    {
      key: 'organizacionId',
      label: tab === 'sima' ? 'Organización' : 'Cliente',
      render: (id) => <span className="text-slate-700">{getOrgName(id)}</span>,
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Usuarios</h2>
          <p className="text-slate-400 text-sm">
            {loading
              ? 'Cargando…'
              : `${usuariosFiltrados.length} usuario${usuariosFiltrados.length !== 1 ? 's' : ''} — ${usuarios.length} en total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setImportOpen(true)}
            disabled={loading || !!loadError}
          >
            Importar Excel
          </Button>
          <Button onClick={openCreate} disabled={loading || !!loadError}>
            + Nuevo usuario
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {TABS.map((t) => {
          const count = usuarios.filter((u) =>
            t.id === 'sima' ? isSima(u) : !isSima(u),
          ).length
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              {!loading && (
                <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-semibold ${
                  tab === t.id ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between">
          <span>No se pudo conectar con la API: {loadError}</span>
          <Button variant="secondary" size="sm" onClick={loadData}>
            Reintentar
          </Button>
        </div>
      )}

      {!loadError && (
        <Table
          columns={columns}
          data={usuariosFiltrados}
          actions={(row) => (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                Editar
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(row)}>
                Eliminar
              </Button>
            </>
          )}
        />
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1">Nombre</label>
              <input
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre"
              />
            </div>
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1">Apellido</label>
              <input
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                value={form.apellido}
                onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
                placeholder="Apellido"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1">DNI</label>
              <input
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm font-mono focus:outline-none focus:border-red-600"
                value={form.dni}
                onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
                placeholder="DNI"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1">
                Email <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@empresa.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">Rol</label>
            <select
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
              value={form.rol}
              onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">
              {tab === 'sima' ? 'Organización' : 'Cliente'}
            </label>
            <select
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
              value={form.organizacionId}
              onChange={(e) => setForm((f) => ({ ...f, organizacionId: e.target.value }))}
            >
              <option value="">— Sin organización —</option>
              {orgsParaTab.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <ImportUsuariosModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </div>
  )
}
