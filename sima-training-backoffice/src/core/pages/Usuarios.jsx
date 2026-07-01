import { useEffect, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { usuariosApi } from '../api/usuarios'
import { organizacionesApi } from '../api/organizaciones'
import ImportUsuariosModal from '../components/ImportUsuariosModal'

const ROLES = ['ADMINISTRADOR', 'COORDINADOR', 'ALUMNO']

const roleBadge = {
  ADMINISTRADOR: 'bg-red-50 text-red-600',
  COORDINADOR:   'bg-blue-50 text-blue-600',
  ALUMNO:        'bg-emerald-50 text-emerald-600',
}

const TABS = [
  { id: 'todos',      label: 'Todos' },
  { id: 'alumnos',    label: 'Alumnos' },
  { id: 'operadores', label: 'Operadores' },
]

// Clasificación del alumno (excluyente). Solo aplica a rol ALUMNO.
const CLASIFICACIONES = ['SIMA', 'SUBCONTRATISTA', 'CLIENTE', 'INVITADO']

const clasifBadge = {
  SIMA:           'bg-sky-50 text-sky-600',
  SUBCONTRATISTA: 'bg-amber-50 text-amber-600',
  CLIENTE:        'bg-blue-50 text-blue-600',
  INVITADO:       'bg-slate-100 text-slate-600',
}

const clasifLabel = (c) => (c ? c.charAt(0) + c.slice(1).toLowerCase() : '—')

// Tipo de organización → clasificación sugerida (editable en el form).
const ORG_TIPO_A_CLASIF = {
  INTERNA:        'SIMA',
  CLIENTE:        'CLIENTE',
  SUBCONTRATISTA: 'SUBCONTRATISTA',
}

const esAlumno = (u) => u.rol === 'ALUMNO'
const esOperador = (u) => u.rol === 'ADMINISTRADOR' || u.rol === 'COORDINADOR'
const matchTab = (u, t) =>
  t === 'todos' ? true : t === 'alumnos' ? esAlumno(u) : esOperador(u)

// Rol por defecto al crear, según la tab activa.
const defaultRolParaTab = (t) => (t === 'alumnos' ? 'ALUMNO' : 'COORDINADOR')

const emptyForm = {
  nombre: '',
  apellido: '',
  dni: '',
  email: '',
  rol: 'COORDINADOR',
  clasificacion: 'INVITADO',
  organizacionId: '',
  legajo: '',
  puesto: '',
  sector: '',
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [organizaciones, setOrganizaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [tab, setTab] = useState('todos')

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [clasifFilter, setClasifFilter] = useState('todas')

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

  const usuariosFiltrados = usuarios
    .filter((u) => matchTab(u, tab))
    .filter((u) => clasifFilter === 'todas' || u.clasificacion === clasifFilter)
    .filter((u) => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (
        u.dni.toLowerCase().includes(q) ||
        u.nombre.toLowerCase().includes(q) ||
        u.apellido.toLowerCase().includes(q)
      )
    })

  const getOrgName = (id) =>
    organizaciones.find((o) => o.id === id)?.nombre ?? '—'

  // Clasificación sugerida según el tipo de la organización elegida.
  const clasifDesdeOrg = (orgId) => {
    const org = organizaciones.find((o) => o.id === Number(orgId))
    return ORG_TIPO_A_CLASIF[org?.tipo] ?? 'INVITADO'
  }

  const isAlumnoForm = form.rol === 'ALUMNO'

  const openCreate = () => {
    const defaultOrg = organizaciones[0]?.id ?? ''
    setForm({
      ...emptyForm,
      rol: defaultRolParaTab(tab),
      organizacionId: defaultOrg,
      clasificacion: defaultOrg ? clasifDesdeOrg(defaultOrg) : 'INVITADO',
    })
    setFormError(null)
    setModal({ mode: 'create' })
  }

  const openEdit = (usuario) => {
    const datos = usuario.datos ?? {}
    setForm({
      nombre: usuario.nombre ?? '',
      apellido: usuario.apellido ?? '',
      dni: usuario.dni ?? '',
      email: usuario.email ?? '',
      rol: usuario.rol ?? 'COORDINADOR',
      clasificacion: usuario.clasificacion ?? 'INVITADO',
      organizacionId: usuario.organizacionId ?? '',
      legajo: datos.legajo ?? '',
      puesto: datos.puesto ?? '',
      sector: datos.sector ?? '',
    })
    setFormError(null)
    setModal({ mode: 'edit', data: usuario })
  }

  const buildPayload = () => {
    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      dni: form.dni.trim(),
      rol: form.rol,
      organizacionId: form.organizacionId ? Number(form.organizacionId) : undefined,
    }
    if (form.email.trim()) payload.email = form.email.trim()

    // Clasificación y datos de nómina solo para alumnos.
    if (form.rol === 'ALUMNO') {
      payload.clasificacion = form.clasificacion
      const datos = {}
      if (form.legajo.trim()) datos.legajo = form.legajo.trim()
      if (form.puesto.trim()) datos.puesto = form.puesto.trim()
      if (form.sector.trim()) datos.sector = form.sector.trim()
      payload.datos = datos
    }
    return payload
  }

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.dni.trim()) {
      setFormError('Nombre, apellido y DNI son obligatorios')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (modal.mode === 'create') {
        await usuariosApi.create(buildPayload())
      } else {
        await usuariosApi.update(modal.data.id, buildPayload())
      }
      setModal(null)
      await loadData()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (usuario) => {
    const ok = window.confirm(
      `¿Dar de baja a ${usuario.nombre} ${usuario.apellido}? Esta acción se puede revertir desde la base.`,
    )
    if (!ok) return
    try {
      await usuariosApi.remove(usuario.id)
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
      key: 'clasificacion',
      label: 'Clasificación',
      render: (val) =>
        val ? (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${clasifBadge[val] ?? 'bg-slate-100 text-slate-600'}`}
          >
            {clasifLabel(val)}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'organizacionId',
      label: 'Organización',
      render: (id) => <span className="text-slate-700">{getOrgName(id)}</span>,
    },
    {
      key: 'datos',
      label: 'Puesto',
      render: (datos) => <span className="text-slate-500">{datos?.puesto ?? '—'}</span>,
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
          const count = usuarios.filter((u) => matchTab(u, t.id)).length
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

      {/* Búsqueda + filtro por clasificación */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por DNI, nombre o apellido…"
          className="w-full max-w-sm bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
        />
        <select
          value={clasifFilter}
          onChange={(e) => setClasifFilter(e.target.value)}
          className="bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
        >
          <option value="todas">Todas las clasificaciones</option>
          {CLASIFICACIONES.map((c) => (
            <option key={c} value={c}>
              {clasifLabel(c)}
            </option>
          ))}
        </select>
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
                Dar de baja
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
            <label className="block text-slate-700 text-sm font-medium mb-1">Organización</label>
            <select
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
              value={form.organizacionId}
              onChange={(e) => {
                const organizacionId = e.target.value
                // Autocompletar la clasificación sugerida según el tipo de la org.
                setForm((f) => ({
                  ...f,
                  organizacionId,
                  clasificacion: organizacionId ? clasifDesdeOrg(organizacionId) : 'INVITADO',
                }))
              }}
            >
              <option value="">— Sin organización —</option>
              {organizaciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>

          {isAlumnoForm && (
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-1">Clasificación</label>
                <select
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                  value={form.clasificacion}
                  onChange={(e) => setForm((f) => ({ ...f, clasificacion: e.target.value }))}
                >
                  {CLASIFICACIONES.map((c) => (
                    <option key={c} value={c}>
                      {clasifLabel(c)}
                    </option>
                  ))}
                </select>
                <p className="text-slate-400 text-xs mt-1">
                  Se sugiere según la organización, pero podés cambiarla.
                </p>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Datos de nómina</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 text-sm font-medium mb-1">
                    Legajo <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm font-mono focus:outline-none focus:border-red-600"
                    value={form.legajo}
                    onChange={(e) => setForm((f) => ({ ...f, legajo: e.target.value }))}
                    placeholder="EJ-4521"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 text-sm font-medium mb-1">
                    Puesto <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                    value={form.puesto}
                    onChange={(e) => setForm((f) => ({ ...f, puesto: e.target.value }))}
                    placeholder="Operador de Planta"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 text-sm font-medium mb-1">
                    Sector <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                    value={form.sector}
                    onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                    placeholder="Producción"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ImportUsuariosModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadData}
      />
    </div>
  )
}
