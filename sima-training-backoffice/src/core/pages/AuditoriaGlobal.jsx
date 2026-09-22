import { useEffect, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import SearchableSelect from '../../components/SearchableSelect'
import { auditoriaApi } from '../api/auditoria'
import { usuariosApi } from '../api/usuarios'
import { organizacionesApi } from '../api/organizaciones'
import { modulosApi } from '../api/modulos'
import { puestosApi } from '../api/puestos'
import { centrosCostoApi } from '../api/centrosCosto'
import { roleBadge } from '../format/badges'

// Log GLOBAL de auditoría (GET /audit-log), transversal a todas las entidades
// — distinto del historial por persona que ya vive dentro de HistorialUsuario.jsx
// (no se toca acá, sigue existiendo tal cual). Ver docs/decisiones/auditoria.md.

const LIMIT = 50

// Las 8 `entidad` que el backend audita hoy, para las 6 "familias" reales
// (Vinculacion/VinculacionPuestoCentro son las dos mitades del par puesto+
// centro; Modulo/ModuloVersion, del módulo — ver auditoria.md). No hay
// endpoint que liste esto, así que es una constante: una entidad auditada
// nueva del lado del backend se suma acá también.
const ENTIDADES = [
  { id: 'Usuario', label: 'Usuario' },
  { id: 'Vinculacion', label: 'Vinculación' },
  { id: 'VinculacionPuestoCentro', label: 'Puesto y centro de costo' },
  { id: 'Organizacion', label: 'Organización' },
  { id: 'ReglaAsignacion', label: 'Regla de asignación' },
  { id: 'Pregunta', label: 'Pregunta' },
  { id: 'Modulo', label: 'Módulo' },
  { id: 'ModuloVersion', label: 'Versión de módulo' },
]
const ENTIDAD_LABEL = Object.fromEntries(ENTIDADES.map((e) => [e.id, e.label]))

// ALUMNO no entra: el DTO lo acepta como valor de `actorRol` (es
// `@IsEnum(RolUsuario)`, el enum completo), pero no es una suposición que se
// excluya acá — es estructuralmente imposible que aparezca. `actorRol` sale
// SIEMPRE de `request.usuario` (JwtAuthGuard → @Actor() → actorDeIdentidad()),
// y JwtAuthGuard rechaza con 403 cualquier login cuya Vinculacion sea ALUMNO
// antes de llegar a setear esa identidad (jwt-auth.guard.ts: "Los alumnos
// ingresan por la app SIMA CHECK, no por el backoffice" — ver también el
// comentario de matriz-permisos.ts). Un alumno nunca tiene sesión de
// backoffice, así que ninguna fila de AuditLog puede tener actorRol=ALUMNO.
// Ofrecerlo sería un filtro que siempre da "sin resultados" a propósito, no
// por falta de casos todavía.
const ROLES_ACTOR = ['ADMINISTRADOR', 'COORDINADOR', 'AUDITOR']

const ACCION = {
  CREATE: { label: 'Alta', cls: 'bg-emerald-50 text-emerald-600' },
  UPDATE: { label: 'Modificación', cls: 'bg-blue-50 text-blue-600' },
  DELETE: { label: 'Baja', cls: 'bg-red-50 text-red-600' },
}

// `actor` es el string de CANAL (de dónde entró el cambio) — DISTINTO de la
// identidad real (actorNombre/actorApellido/actorRol). No confundir uno con
// otro es justamente el punto de esta pantalla (ver auditoria.md).
const CANAL = {
  backoffice: 'Backoffice',
  import: 'Import',
  tablet: 'Tablet',
}

// PKs internas que no dicen nada de negocio (mismo criterio que HistorialUsuario.jsx).
const CAMPOS_OCULTOS = new Set(['id', 'usuarioId'])

const CAMPO = {
  nombre: 'Nombre',
  apellido: 'Apellido',
  dni: 'DNI',
  email: 'Email',
  organizacionId: 'Organización',
  organizacionPadreId: 'Organización cliente',
  tipo: 'Tipo',
  rol: 'Rol',
  activa: 'Activa',
  activo: 'Activo',
  deletedAt: 'Baja',
  puestoId: 'Puesto',
  centroCostoId: 'Centro de costo',
  principal: 'Principal',
  moduloId: 'Módulo',
  texto: 'Enunciado',
  preguntas: 'Preguntas',
  criterios: 'Criterios',
  agregadas: 'Agregadas',
  quitadas: 'Quitadas',
  descripcion: 'Descripción',
  vigenciaMeses: 'Vigencia (meses)',
  demoPublico: 'Modo demostración',
  estado: 'Estado',
  anio: 'Año',
  mayor: 'Mayor',
  menor: 'Menor',
  activadaEn: 'Activada el',
  esNuevaLinea: 'Es versión nueva',
  preguntasPorExamen: 'Preguntas por examen',
  umbralAprobacion: 'Umbral de aprobación',
  maxIntentos: 'Máximo de intentos',
  esperaEntreIntentosMinutos: 'Espera entre intentos (min)',
}

const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-AR') : '—')
const capitalizar = (s) => s.charAt(0) + s.slice(1).toLowerCase()
const chip = (cls) => `px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`
const inputCls = 'bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

function ActorCell({ row }) {
  if (!row.actorNombre && !row.actorApellido) {
    // Filas de antes de sumar identidad real, o canales sin IdentidadResuelta
    // (import/scripts). No se inventa un nombre: se dice explícito que no hay.
    return <span className="text-slate-400 text-sm italic">Identidad no registrada</span>
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-slate-800 text-sm">
        {[row.actorNombre, row.actorApellido].filter(Boolean).join(' ')}
      </span>
      {row.actorRol && (
        <span className={chip(roleBadge[row.actorRol] ?? 'bg-slate-100 text-slate-600')}>
          {capitalizar(row.actorRol)}
        </span>
      )}
    </div>
  )
}

export default function AuditoriaGlobal() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [entidad, setEntidad] = useState('')
  const [actorRol, setActorRol] = useState('')
  const [actorUsuarioId, setActorUsuarioId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // Catálogos para traducir ids crudos a nombres — el backend los devuelve
  // TAL CUAL (ver auditoria.md: "la pantalla que lo consume ya tiene los
  // catálogos cargados"). Se piden una sola vez; si fallan, el fallback en
  // toda esta pantalla es mostrar el id crudo, nunca inventar un nombre.
  const [catalogos, setCatalogos] = useState(null)
  const [detalle, setDetalle] = useState(null)

  useEffect(() => {
    let activo = true
    Promise.all([
      usuariosApi.list(),
      organizacionesApi.list(),
      modulosApi.list(),
      puestosApi.list(),
      centrosCostoApi.list(),
    ])
      .then(async ([usuarios, organizaciones, modulos, puestos, centrosCosto]) => {
        // versión → módulo: GET /modulos sólo trae el id de la versión
        // VIGENTE y del BORRADOR en curso (`vigente.id`/`borradorId`), no el
        // historial completo — un log de auditoría de ModuloVersion puede
        // apuntar a una versión ya ARCHIVADA, que no está en ninguno de los
        // dos. Se resuelve pidiendo el historial de cada módulo
        // (GET /modulos/:id/versiones, el mismo que usa "Historial" en
        // TrainingModules.jsx): son tantos requests como MÓDULOS haya —un
        // catálogo chico, pedido una sola vez acá— nunca uno por fila del
        // log, así que no es un N+1 sobre la auditoría.
        const historiales = await Promise.all(
          modulos.map((m) => modulosApi.versiones(m.id).catch(() => [])),
        )
        if (!activo) return
        const moduloVersion = new Map()
        modulos.forEach((m, i) => {
          for (const v of historiales[i]) moduloVersion.set(String(v.id), m.nombre)
        })
        setCatalogos({
          usuario: new Map(usuarios.map((u) => [String(u.id), `${u.nombre} ${u.apellido}`])),
          organizacion: new Map(organizaciones.map((o) => [String(o.id), o.nombre])),
          modulo: new Map(modulos.map((m) => [String(m.id), m.nombre])),
          moduloVersion,
          puesto: new Map(puestos.map((p) => [String(p.id), p.nombre])),
          centroCosto: new Map(centrosCosto.map((c) => [String(c.id), c.nombre])),
          // Opciones del filtro "Usuario actor": el mismo GET /usuarios de
          // arriba, acotado a los roles que de hecho pueden ser actor
          // (ROLES_ACTOR — un ALUMNO nunca tiene sesión de backoffice, ver el
          // comentario de más abajo) para no ofrecer una nómina entera donde
          // casi nadie puede aparecer en este log. El DNI viaja tal cual lo
          // muestra el resto de la app — crudo, sin puntos (mismo criterio
          // que Usuarios.jsx/HistorialUsuario.jsx) — y GET /usuarios ya lo
          // devuelve a cualquier rol con LECTURA_BACKOFFICE, un superconjunto
          // de quién puede entrar a esta pantalla (AUDITORIA), así que
          // mostrarlo acá no expone nada que ADMINISTRADOR/AUDITOR no vean
          // ya en Usuarios. El label sirve de golpe como texto mostrado Y
          // buscado (SearchableSelect filtra sobre `label`), por eso no lleva
          // formato con puntos: "27.856.103" no matchea si alguien tipea
          // "27856103" tal cual.
          actorOptions: usuarios
            .filter((u) => ROLES_ACTOR.includes(u.vinculacion?.rol))
            .map((u) => ({
              id: String(u.id),
              label: `${u.nombre} ${u.apellido} · DNI ${u.dni}`,
            }))
            .sort((a, b) => a.label.localeCompare(b.label, 'es')),
        })
      })
      .catch(() => { /* sólo son para traducir nombres; sin ellos, cae al id crudo */ })
    return () => { activo = false }
  }, [])

  // Cambiar cualquier filtro vuelve a la página 1 — mismo criterio que
  // Usuarios.jsx: no tendría sentido quedarse en la página 4 de un resultado
  // que ya cambió por completo.
  const setFiltro = (setter) => (valor) => {
    setter(valor)
    setPage(1)
  }

  const load = () => {
    setLoading(true)
    setError(null)
    auditoriaApi
      .listarGlobal({
        entidad: entidad || undefined,
        actorRol: actorRol || undefined,
        actorUsuarioId: actorUsuarioId || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        page,
        limit: LIMIT,
      })
      .then((res) => {
        setRows(res.data)
        setTotal(res.total)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  // Debounce, mismo patrón que el buscador de Preguntas: `actorUsuarioId` es
  // texto libre (dispara en cada tecla), el resto de los filtros no lo
  // necesitan pero comparten el mismo efecto por simplicidad.
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entidad, actorRol, actorUsuarioId, desde, hasta, page])

  const filtrando = !!(entidad || actorRol || actorUsuarioId || desde || hasta)
  const limpiarFiltros = () => {
    setEntidad('')
    setActorRol('')
    setActorUsuarioId('')
    setDesde('')
    setHasta('')
    setPage(1)
  }

  const totalPaginas = Math.max(1, Math.ceil(total / LIMIT))

  // entidadId → nombre, sólo para las entidades cuyo id PROPIO es resoluble
  // contra un catálogo ya cargado. Usuario/Organizacion/Modulo: directo, el
  // id del log ES el id del catálogo. ModuloVersion: el id del log es el de
  // la VERSIÓN, no el del módulo — se resuelve contra `moduloVersion`, el
  // mapa versión→nombre-de-módulo armado desde el historial de cada módulo
  // (ver el efecto de arriba). El resto (Vinculacion, VinculacionPuestoCentro,
  // ReglaAsignacion, Pregunta) no tiene una fuente clara para resolver a un
  // nombre desde acá — Vinculacion en particular guarda el id de la
  // VINCULACIÓN, no el de la persona, y no existe un endpoint que traduzca
  // uno al otro sin volver a construir lo que ya decidimos no tocar. El id
  // crudo queda como identificador, tal como pide la consigna para esos casos.
  const nombreEntidad = (log) => {
    if (!catalogos) return null
    if (log.entidad === 'Usuario') return catalogos.usuario.get(log.entidadId)
    if (log.entidad === 'Organizacion') return catalogos.organizacion.get(log.entidadId)
    if (log.entidad === 'Modulo') return catalogos.modulo.get(log.entidadId)
    if (log.entidad === 'ModuloVersion') return catalogos.moduloVersion.get(log.entidadId)
    return null
  }

  const valorLegible = (campo, valor) => {
    if (valor === null || valor === undefined) return '—'
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
    if (typeof valor === 'object') {
      // Resúmenes de contenido armados a mano (asignarPreguntas/setCriterios):
      // { agregadas, quitadas, ... } en vez de un valor escalar.
      return Object.entries(valor).map(([k, v]) => `${CAMPO[k] ?? k}: ${v}`).join(' · ')
    }
    if (catalogos) {
      if (campo === 'puestoId') return catalogos.puesto.get(String(valor)) ?? String(valor)
      if (campo === 'centroCostoId') return catalogos.centroCosto.get(String(valor)) ?? String(valor)
      if (campo === 'organizacionId' || campo === 'organizacionPadreId') {
        return catalogos.organizacion.get(String(valor)) ?? String(valor)
      }
      if (campo === 'moduloId') return catalogos.modulo.get(String(valor)) ?? String(valor)
    }
    if (campo === 'rol') return capitalizar(String(valor))
    if (campo === 'deletedAt' || campo === 'activadaEn') return fechaHora(valor)
    return String(valor)
  }

  const columns = [
    {
      key: 'createdAt',
      label: 'Fecha y hora',
      render: (val) => (
        <span className="text-slate-600 text-sm whitespace-nowrap font-mono">{fechaHora(val)}</span>
      ),
    },
    {
      key: 'actor',
      label: 'Actor',
      render: (_, row) => <ActorCell row={row} />,
    },
    {
      key: 'canal',
      label: 'Canal',
      render: (_, row) => <span className="text-slate-500 text-sm">{CANAL[row.actor] ?? row.actor}</span>,
    },
    {
      key: 'accion',
      label: 'Acción',
      render: (val) => {
        const a = ACCION[val] ?? { label: val, cls: 'bg-slate-100 text-slate-600' }
        return <span className={chip(a.cls)}>{a.label}</span>
      },
    },
    {
      key: 'entidad',
      label: 'Entidad afectada',
      render: (_, row) => {
        const nombre = nombreEntidad(row)
        return (
          <div className="text-sm">
            <span className="text-slate-700 font-medium">{ENTIDAD_LABEL[row.entidad] ?? row.entidad}</span>
            {nombre ? (
              <span className="text-slate-500"> · {nombre}</span>
            ) : (
              <span className="text-slate-400 font-mono text-xs">
                {' · '}
                {/* Versión archivada/eliminada cuyo módulo ya no se puede
                    resolver: "ID" aclara que lo que sigue es un identificador
                    de VERSIÓN, no de módulo — sin eso se lee como si fuera el
                    nombre. Sólo para esta entidad, no toca el fallback de las demás. */}
                {row.entidad === 'ModuloVersion' ? `ID ${row.entidadId}` : row.entidadId}
              </span>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-slate-900 font-bold text-xl">Auditoría</h2>
        <p className="text-slate-400 text-sm">
          {loading
            ? 'Cargando…'
            : `${total} registro${total !== 1 ? 's' : ''}${filtrando ? ' con los filtros aplicados' : ''}`}
        </p>
      </div>

      {/* Los cuatro filtros que soporta el contrato de GET /audit-log
          (FindAuditLogDto), combinables entre sí con AND. */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-slate-500 text-xs font-medium mb-1">Entidad</label>
          <select className={inputCls} value={entidad} onChange={(e) => setFiltro(setEntidad)(e.target.value)}>
            <option value="">Todas</option>
            {ENTIDADES.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-slate-500 text-xs font-medium mb-1">Rol del actor</label>
          <select className={inputCls} value={actorRol} onChange={(e) => setFiltro(setActorRol)(e.target.value)}>
            <option value="">Todos</option>
            {ROLES_ACTOR.map((r) => (
              <option key={r} value={r}>{capitalizar(r)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-slate-500 text-xs font-medium mb-1">Usuario actor</label>
          {/* Buscable por nombre, apellido o DNI (el filtro de SearchableSelect
              corre sobre `label`, que ya trae los tres). Lo que viaja al
              backend sigue siendo el id real (`actorOptions` en el efecto de
              catálogos) — nunca se resuelve por nombre/DNI del lado del
              cliente. */}
          <SearchableSelect
            options={catalogos?.actorOptions ?? []}
            value={actorUsuarioId}
            onChange={(id) => setFiltro(setActorUsuarioId)(id)}
            placeholder="Todos"
            emptyLabel="Todos"
            searchPlaceholder="Nombre, apellido o DNI…"
            disabled={!catalogos}
            className="w-full sm:w-56"
          />
        </div>
        <div>
          <label className="block text-slate-500 text-xs font-medium mb-1">Desde</label>
          <input type="date" className={inputCls} value={desde} onChange={(e) => setFiltro(setDesde)(e.target.value)} />
        </div>
        <div>
          <label className="block text-slate-500 text-xs font-medium mb-1">Hasta</label>
          <input type="date" className={inputCls} value={hasta} onChange={(e) => setFiltro(setHasta)(e.target.value)} />
        </div>
        {filtrando && (
          <Button variant="ghost" size="sm" onClick={limpiarFiltros}>Limpiar filtros</Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <span>No se pudo cargar la auditoría: {error}</span>
          <Button variant="secondary" size="sm" onClick={load}>Reintentar</Button>
        </div>
      )}

      {!error && (
        <>
          <Table
            columns={columns}
            data={rows}
            actions={(row) => (
              <Button variant="ghost" size="sm" onClick={() => setDetalle(row)}>Ver cambios</Button>
            )}
          />

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{loading ? 'Cargando…' : `Página ${page} de ${totalPaginas}`}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || page <= 1}
              >
                ← Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
                disabled={loading || page >= totalPaginas}
              >
                Siguiente →
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal open={!!detalle} onClose={() => setDetalle(null)} title="Detalle del cambio" size="lg">
        {detalle && (() => {
          const a = ACCION[detalle.accion] ?? { label: detalle.accion, cls: 'bg-slate-100 text-slate-600' }
          const nombre = nombreEntidad(detalle)
          // Igual que HistorialUsuario.jsx: se esconden las PKs internas y los
          // pares donde nada cambió realmente (un CREATE trae, por ejemplo,
          // `deletedAt: null → null`). Un campo redactado SIEMPRE es un cambio
          // real (el backend no lo escribe si no cambió), así que no se filtra
          // por igualdad.
          const cambios = Object.entries(detalle.diff ?? {}).filter(([campo, valor]) => {
            if (CAMPOS_OCULTOS.has(campo)) return false
            if (!valor || typeof valor !== 'object') return false
            if (valor.redactado) return true
            return valor.antes !== valor.despues
          })
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className={chip(a.cls)}>{a.label}</span>
                <span className="text-slate-700 font-medium">{ENTIDAD_LABEL[detalle.entidad] ?? detalle.entidad}</span>
                {nombre ? (
                  <span className="text-slate-500">· {nombre}</span>
                ) : detalle.entidad === 'ModuloVersion' ? (
                  // Versión archivada/eliminada, módulo no resoluble: el "ID"
                  // aclara que lo que sigue es el id de la VERSIÓN, no del
                  // módulo — sin eso se lee como si el módulo se llamara así.
                  <span className="text-slate-400 font-mono text-xs">· ID {detalle.entidadId}</span>
                ) : (
                  <span className="text-slate-400 font-mono text-xs">({detalle.entidadId})</span>
                )}
              </div>
              {/* El id de versión como dato SECUNDARIO, aparte del nombre del
                  módulo (que ya es el dato principal de arriba) — sólo cuando
                  el módulo se pudo resolver: si no, el id ya quedó arriba
                  como "· ID ..." y repetirlo sería ruido. Sólo ModuloVersion:
                  las demás entidades siguen con el "(id)" de siempre. */}
              {nombre && detalle.entidad === 'ModuloVersion' && (
                <p className="text-slate-400 font-mono text-xs -mt-3">ID versión: {detalle.entidadId}</p>
              )}
              <div className="text-sm text-slate-500 space-y-1">
                <div>{fechaHora(detalle.createdAt)}</div>
                <div>Canal: {CANAL[detalle.actor] ?? detalle.actor}</div>
                <div>Actor: <ActorCell row={detalle} /></div>
              </div>
              {cambios.length === 0 ? (
                <p className="text-slate-400 text-sm">Sin cambios de campo registrados.</p>
              ) : (
                <ul className="space-y-1.5 border-t border-slate-100 pt-3">
                  {cambios.map(([campo, valor]) => (
                    <li key={campo} className="text-sm text-slate-600">
                      <span className="text-slate-400">{CAMPO[campo] ?? campo}:</span>{' '}
                      {valor.redactado ? (
                        <span className="italic text-slate-400">dato protegido</span>
                      ) : (
                        <>
                          <span>{valorLegible(campo, valor.antes)}</span>
                          <span className="text-slate-400 mx-1.5">→</span>
                          <span className="font-medium text-slate-800">{valorLegible(campo, valor.despues)}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
