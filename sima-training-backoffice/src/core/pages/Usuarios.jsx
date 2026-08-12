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
import HistorialUsuario from './HistorialUsuario'
import { roleBadge } from '../format/badges'

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
  { id: 'internas',        label: 'SIMA',            tipo: 'INTERNA' },
  { id: 'subcontratistas', label: 'Subcontratistas', tipo: 'SUBCONTRATISTA' },
  { id: 'clientes',        label: 'Clientes',        tipo: 'CLIENTE' },
]

const matchTab = (u, t) => {
  if (t === 'todas') return true
  const tab = TABS.find((x) => x.id === t)
  return u.vinculacion?.organizacion?.tipo === tab?.tipo
}

const selectCls =
  'bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

// Los pares vienen de JSON, así que `parPrincipal` NO es el mismo objeto que su
// entrada dentro de `pares`: comparar por identidad no sirve, se compara por clave.
const clavePar = (par) => `${par.puesto.id}|${par.centroCosto.id}`

// Los pares que la fila no muestra. `principal` es solo display — la persona
// rinde los módulos de TODOS sus pares —, así que la tabla los tiene que poder
// mostrar en vez de mentir por omisión.
const paresAdicionales = (vinculacion) => {
  const pares = vinculacion?.pares ?? []
  const principal = vinculacion?.parPrincipal
  if (!principal) return pares
  const claveDelPrincipal = clavePar(principal)
  return pares.filter((par) => clavePar(par) !== claveDelPrincipal)
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
  // Estos tres los resuelve el BACKEND (?puestoId=/?centroCostoId=/?organizacionId=),
  // no se filtran en memoria: acá solo tenemos el par principal, que es display,
  // y el backend busca sobre TODOS los pares activos de cada persona. Puesto y
  // centro juntos filtran por PAR EXACTO (ver UsuariosService.findAll).
  const [filtroPuesto, setFiltroPuesto] = useState('')
  const [filtroCentro, setFiltroCentro] = useState('')
  const [filtroOrganizacion, setFiltroOrganizacion] = useState('')
  // Filas con los pares adicionales desplegados (ids de usuario).
  const [expandidos, setExpandidos] = useState(() => new Set())
  // Se incrementa para forzar una recarga después de una mutación: el fetch de
  // usuarios vive en un solo efecto, junto con su guarda de respuesta vieja.
  const [reloadKey, setReloadKey] = useState(0)
  // Id de la persona cuyo historial se está viendo, o null para la lista.
  const [historialId, setHistorialId] = useState(null)

  const cargarCatalogos = () =>
    Promise.all([organizacionesApi.list(), puestosApi.list(), centrosCostoApi.list()]).then(
      ([orgs, pue, centros]) => {
        setOrganizaciones(orgs)
        setPuestos(pue)
        setCentrosCosto(centros)
      },
    )

  const recargarUsuarios = () => setReloadKey((k) => k + 1)

  // El import de Excel es el único flujo que además crea puestos y centros
  // nuevos, así que ahí hay que refrescar también los catálogos.
  const recargarTodo = () => {
    cargarCatalogos().catch((err) => setLoadError(err.message))
    recargarUsuarios()
  }

  const handleParesChange = (newPares) => {
    setPares(newPares)
    setParesTouched(true)
  }

  const reintentar = () => {
    setLoadError(null)
    recargarTodo()
  }

  // Los catálogos no dependen de los filtros: se traen una sola vez al montar.
  useEffect(() => {
    cargarCatalogos().catch((err) => setLoadError(err.message))
  }, [])

  // Los usuarios sí: cada cambio de filtro es un request nuevo. `active` evita
  // que la respuesta lenta de un filtro viejo pise a la del filtro actual.
  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    usuariosApi
      .list({
        organizacionId: filtroOrganizacion || undefined,
        puestoId: filtroPuesto || undefined,
        centroCostoId: filtroCentro || undefined,
      })
      .then((data) => {
        if (!active) return
        setUsuarios(data)
        setLoadError(null)
      })
      .catch((err) => active && setLoadError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [filtroOrganizacion, filtroPuesto, filtroCentro, reloadKey])

  const tiposOrgValidos = TIPOS_ORG_POR_ROL[form.rol] ?? []
  const organizacionesValidas = organizaciones.filter((o) => tiposOrgValidos.includes(o.tipo))

  // El filtro de organización se acota al tipo de la tab activa: ofrecer una
  // organización de otro tipo sería ofrecer una combinación que da cero.
  const tipoTab = TABS.find((t) => t.id === tab)?.tipo ?? null
  const organizacionesDelTab = tipoTab
    ? organizaciones.filter((o) => o.tipo === tipoTab)
    : organizaciones

  // Por el mismo motivo, cambiar de tab descarta la organización elegida si no
  // es del tipo nuevo. Puesto y centro no dependen de la tab: se conservan.
  const cambiarTab = (id) => {
    setTab(id)
    const tipo = TABS.find((t) => t.id === id)?.tipo
    if (!tipo || !filtroOrganizacion) return
    const elegida = organizaciones.find((o) => String(o.id) === String(filtroOrganizacion))
    if (elegida?.tipo !== tipo) setFiltroOrganizacion('')
  }

  const hayFiltrosServidor = !!(filtroPuesto || filtroCentro || filtroOrganizacion)
  const hayAlgunFiltro = hayFiltrosServidor || !!search.trim()

  const limpiarFiltros = () => {
    setFiltroPuesto('')
    setFiltroCentro('')
    setFiltroOrganizacion('')
    setSearch('')
  }

  const toggleExpandido = (id) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // La tab y la búsqueda siguen en memoria: la tab filtra por TIPO de
  // organización, y la API solo acepta un organizacionId concreto.
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
      recargarUsuarios()
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
      recargarUsuarios()
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
      key: 'puesto',
      label: 'Puesto',
      render: (_, row) => {
        const par = row.vinculacion?.parPrincipal
        const otros = paresAdicionales(row.vinculacion)
        const abierto = expandidos.has(row.id)
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">{par ? par.puesto.nombre : '—'}</span>
              {otros.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleExpandido(row.id)}
                  title={abierto ? 'Ocultar los demás pares' : 'Ver los demás pares'}
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  {abierto ? '−' : `+${otros.length}`}
                </button>
              )}
            </div>
            {/* Los pares adicionales van ENTEROS acá ("puesto · centro"), no
                partidos entre las dos columnas: un nombre de centro largo que
                envuelva a dos líneas desalinearía las filas y la tabla volvería
                a mentir sobre qué va con qué. El principal es el único par que
                ocupa las dos columnas. */}
            {abierto &&
              otros.map((p) => (
                <div
                  key={clavePar(p)}
                  className={`text-xs ${p.activo ? 'text-slate-500' : 'text-slate-400 line-through'}`}
                >
                  {p.puesto.nombre} · {p.centroCosto.nombre}
                </div>
              ))}
          </div>
        )
      },
    },
    {
      key: 'centroCosto',
      label: 'Centro de costo',
      render: (_, row) => {
        const par = row.vinculacion?.parPrincipal
        return <span className="text-slate-500">{par ? par.centroCosto.nombre : '—'}</span>
      },
    },
  ]

  // El historial se muestra EN LUGAR de la lista, con un early return — mismo
  // patrón que la vista de contenido de TrainingModules.jsx. Es lo que hace que
  // volver conserve la tab, la búsqueda y los usuarios ya cargados: este
  // componente NUNCA se desmonta (no hay navegación de página, `useNavigation`
  // sigue en 'usuarios'), así que todos sus useState siguen vivos y no hace
  // falta levantar el estado a ningún lado.
  //
  // OJO: mover esta vista a una página propia de App.jsx sí desmontaría
  // Usuarios, y volver resetearía los filtros a cero. No es una simplificación
  // pendiente, es lo que este early return evita a propósito.
  if (historialId) {
    return (
      <HistorialUsuario
        usuarioId={historialId}
        onVolver={() => setHistorialId(null)}
        // Los catálogos ya están en memoria (los trae fetchAll al montar): se
        // pasan para traducir a nombres los ids crudos del audit log, sin
        // agregar un request.
        puestos={puestos}
        centrosCosto={centrosCosto}
        organizaciones={organizaciones}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Usuarios</h2>
          {/* Con filtros de servidor activos `usuarios` ya es el resultado
              filtrado, así que "en total" dejaría de ser el total real: se cae
              el sufijo en vez de mostrar un número que miente. */}
          <p className="text-slate-400 text-sm">
            {loading
              ? 'Cargando…'
              : hayFiltrosServidor
                ? `${usuariosFiltrados.length} usuario${usuariosFiltrados.length !== 1 ? 's' : ''} con los filtros aplicados`
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
              onClick={() => cambiarTab(t.id)}
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

      {/* Búsqueda y filtros. Los tres selects los resuelve el backend; la
          búsqueda es en memoria. Todo combina con AND, también con la tab. */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por DNI, nombre o apellido…"
          className="w-full max-w-sm bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
        />
        {/* Catálogo completo, no solo los activos: un puesto dado de baja puede
            seguir teniendo gente asignada, y hay que poder encontrarla. */}
        <select
          className={selectCls}
          value={filtroPuesto}
          onChange={(e) => setFiltroPuesto(e.target.value)}
        >
          <option value="">Todos los puestos</option>
          {puestos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}{!p.activo ? ' (inactivo)' : ''}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={filtroCentro}
          onChange={(e) => setFiltroCentro(e.target.value)}
        >
          <option value="">Todos los centros de costo</option>
          {centrosCosto.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}{!c.activo ? ' (inactivo)' : ''}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={filtroOrganizacion}
          onChange={(e) => setFiltroOrganizacion(e.target.value)}
        >
          <option value="">Todas las organizaciones</option>
          {organizacionesDelTab.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
        {hayAlgunFiltro && (
          <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between">
          <span>No se pudo conectar con la API: {loadError}</span>
          <Button variant="secondary" size="sm" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      )}

      {!loadError && (
        <Table
          columns={columns}
          data={usuariosFiltrados}
          // La celda de Puesto crece al desplegar los pares adicionales; sin
          // esto el resto de la fila se centraría contra esa altura.
          alignTop
          actions={(row) => (
            <>
              <Button variant="ghost" size="sm" onClick={() => setHistorialId(row.id)}>
                Ver historial
              </Button>
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
            {modal?.mode === 'create' ? (
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
        onImported={recargarTodo}
      />
    </div>
  )
}
