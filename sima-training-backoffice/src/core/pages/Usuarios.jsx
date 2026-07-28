import { useEffect, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { usuariosApi } from '../api/usuarios'
import { organizacionesApi } from '../api/organizaciones'
import { puestosApi } from '../api/puestos'
import { centrosCostoApi } from '../api/centrosCosto'
import ImportUsuariosModal from '../components/ImportUsuariosModal'
import ParesPuestoCentro from '../components/ParesPuestoCentro'

const roleBadge = {
  ADMINISTRADOR: 'bg-red-50 text-red-600',
  COORDINADOR:   'bg-blue-50 text-blue-600',
  AUDITOR:       'bg-violet-50 text-violet-600',
  ALUMNO:        'bg-emerald-50 text-emerald-600',
}

// Decisión de producto: el backoffice solo da de alta ALUMNOS por ahora (la
// abstracción de roles del sistema todavía no está definida). El backend
// sigue soportando los cuatro roles (ADMINISTRADOR/COORDINADOR/AUDITOR/ALUMNO)
// sin cambios — esto es una simplificación temporal solo de este formulario.
const ROL_ALTA = 'ALUMNO'

// Espejo de sima-training-api/src/usuarios/matriz-rol-organizacion.ts —
// si esa matriz cambia, actualizar acá también. Se usa para filtrar el select
// de Organización según el rol efectivo (ROL_ALTA al crear, el rol ya guardado
// al editar), para no ofrecer una combinación rol/organización que el backend
// vaya a rechazar con 400.
const TIPOS_ORG_POR_ROL = {
  ADMINISTRADOR: ['INTERNA'],
  COORDINADOR:   ['INTERNA'],
  AUDITOR:       ['INTERNA', 'CLIENTE'],
  ALUMNO:        ['INTERNA', 'SUBCONTRATISTA'],
}

const TABS = [
  { id: 'todas',           label: 'Todas' },
  { id: 'internas',        label: 'Internas',        tipo: 'INTERNA' },
  { id: 'subcontratistas', label: 'Subcontratistas', tipo: 'SUBCONTRATISTA' },
  { id: 'clientes',        label: 'Clientes',        tipo: 'CLIENTE' },
]

const matchTab = (u, t) => {
  if (t === 'todas') return true
  const tab = TABS.find((x) => x.id === t)
  return u.vinculacion?.organizacion?.tipo === tab?.tipo
}

const emptyForm = {
  nombre: '',
  apellido: '',
  dni: '',
  email: '',
  rol: ROL_ALTA,
  organizacionId: '',
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [organizaciones, setOrganizaciones] = useState([])
  const [puestos, setPuestos] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [tab, setTab] = useState('todas')

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [pares, setPares] = useState([])
  const [paresTouched, setParesTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [search, setSearch] = useState('')

  const fetchAll = async () => {
    const [us, orgs, pue, centros] = await Promise.all([
      usuariosApi.list(),
      organizacionesApi.list(),
      puestosApi.list(),
      centrosCostoApi.list(),
    ])
    setUsuarios(us)
    setOrganizaciones(orgs)
    setPuestos(pue)
    setCentrosCosto(centros)
  }

  const handleParesChange = (newPares) => {
    setPares(newPares)
    setParesTouched(true)
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

  const tiposOrgValidos = TIPOS_ORG_POR_ROL[form.rol] ?? []
  const organizacionesValidas = organizaciones.filter((o) => tiposOrgValidos.includes(o.tipo))

  const usuariosFiltrados = usuarios
    .filter((u) => matchTab(u, tab))
    .filter((u) => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (
        u.dni.toLowerCase().includes(q) ||
        u.nombre.toLowerCase().includes(q) ||
        u.apellido.toLowerCase().includes(q)
      )
    })

  const openCreate = () => {
    const tiposValidos = TIPOS_ORG_POR_ROL[ROL_ALTA]
    const defaultOrg = organizaciones.find((o) => tiposValidos.includes(o.tipo))?.id ?? ''
    setForm({
      ...emptyForm,
      rol: ROL_ALTA,
      organizacionId: defaultOrg,
    })
    setPares([])
    setParesTouched(false)
    setFormError(null)
    setModal({ mode: 'create' })
  }

  const openEdit = (usuario) => {
    setForm({
      nombre: usuario.nombre ?? '',
      apellido: usuario.apellido ?? '',
      dni: usuario.dni ?? '',
      email: usuario.email ?? '',
      rol: usuario.vinculacion?.rol ?? ROL_ALTA,
      organizacionId: usuario.vinculacion?.organizacion?.id ?? '',
    })
    setPares(
      (usuario.vinculacion?.pares ?? []).map((par) => ({
        puestoId: par.puesto.id,
        centroCostoId: par.centroCosto.id,
        principal: par.principal,
      })),
    )
    setParesTouched(false)
    setFormError(null)
    setModal({ mode: 'edit', data: usuario })
  }

  // Valida los pares en memoria y devuelve el array final ordenado (el
  // principal primero: el backend deriva `principal` de la posición 0, no de
  // un campo). Si no hay ninguno marcado, el primero se toma como principal.
  const validarPares = () => {
    for (const par of pares) {
      if (!par.puestoId || !par.centroCostoId) {
        return { error: 'Completá puesto y centro de costo en todos los pares, o quitá la fila' }
      }
    }
    const claves = new Set(pares.map((p) => `${p.puestoId}|${p.centroCostoId}`))
    if (claves.size !== pares.length) {
      return { error: 'Hay pares de puesto y centro de costo repetidos' }
    }
    if (pares.length === 0) return { pares: [] }
    const conPrincipal = pares.some((p) => p.principal)
      ? pares
      : pares.map((p, i) => ({ ...p, principal: i === 0 }))
    const principal = conPrincipal.find((p) => p.principal)
    const resto = conPrincipal.filter((p) => p !== principal)
    return { pares: [principal, ...resto] }
  }

  const buildPayload = (paresFinal) => {
    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      dni: form.dni.trim(),
      vinculacion: {
        organizacionId: form.organizacionId ? Number(form.organizacionId) : undefined,
        // El rol solo se manda al crear (siempre ALUMNO). Al editar se omite
        // a propósito: UpdateVinculacionDto.rol es opcional y el backend no
        // toca lo que no viene, así que el rol real de un usuario legacy
        // (ADMINISTRADOR/COORDINADOR/AUDITOR) nunca se pisa en silencio.
        ...(modal.mode === 'create' ? { rol: ROL_ALTA } : {}),
      },
    }
    if (form.email.trim()) payload.email = form.email.trim()

    // Los pares se mandan siempre al crear (no hay estado previo que
    // preservar); al editar, solo si el usuario tocó la sección — mandar el
    // campo de más pisaría el set completo con lo que había al abrir el form.
    if (modal.mode === 'create' || paresTouched) {
      payload.vinculacion.pares = paresFinal.map(({ puestoId, centroCostoId }) => ({
        puestoId,
        centroCostoId,
      }))
    }

    return payload
  }

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.apellido.trim() || !form.dni.trim()) {
      setFormError('Nombre, apellido y DNI son obligatorios')
      return
    }
    const paresValidacion = validarPares()
    if (paresValidacion.error) {
      setFormError(paresValidacion.error)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload = buildPayload(paresValidacion.pares)
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
      render: (_, row) => {
        const rol = row.vinculacion?.rol
        return rol ? (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${roleBadge[rol] ?? 'bg-slate-100 text-slate-600'}`}
          >
            {rol.toLowerCase()}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )
      },
    },
    {
      key: 'organizacion',
      label: 'Organización',
      render: (_, row) => (
        <span className="text-slate-700">{row.vinculacion?.organizacion?.nombre ?? '—'}</span>
      ),
    },
    {
      key: 'parPrincipal',
      label: 'Puesto / Centro de costo',
      render: (_, row) => {
        const par = row.vinculacion?.parPrincipal
        return (
          <span className="text-slate-500">
            {par ? `${par.puesto.nombre} · ${par.centroCosto.nombre}` : '—'}
          </span>
        )
      },
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

      {/* Búsqueda */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por DNI, nombre o apellido…"
          className="w-full max-w-sm bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
        />
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
            <Button onClick={handleSave} disabled={saving || organizacionesValidas.length === 0}>
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
            {modal.mode === 'create' ? (
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${roleBadge[ROL_ALTA]}`}
              >
                {ROL_ALTA.toLowerCase()}
              </span>
            ) : (
              <>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${roleBadge[form.rol] ?? 'bg-slate-100 text-slate-600'}`}
                >
                  {form.rol.toLowerCase()}
                </span>
                <p className="text-slate-400 text-xs mt-1">
                  El rol no se puede cambiar desde este formulario.
                </p>
              </>
            )}
          </div>
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">Organización</label>
            {organizacionesValidas.length === 0 ? (
              <p className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded px-3 py-2">
                No hay organizaciones de tipo {tiposOrgValidos.join(' o ')} cargadas para el rol{' '}
                {form.rol.toLowerCase()}. Creá una organización de ese tipo antes de continuar.
              </p>
            ) : (
              <select
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                value={form.organizacionId}
                onChange={(e) => setForm((f) => ({ ...f, organizacionId: e.target.value }))}
              >
                {organizacionesValidas.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Puestos y centros de costo
            </p>
            <ParesPuestoCentro
              pares={pares}
              onChange={handleParesChange}
              puestos={puestos}
              centrosCosto={centrosCosto}
            />
          </div>
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
