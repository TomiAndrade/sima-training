import { useEffect, useMemo, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import { usuariosApi } from '../api/usuarios'
import { roleBadge, origenBadge } from '../format/badges'
import { formatVersionNumero } from '../format/version'

// Hoja de vida de una persona: todo lo que GET /usuarios/:id/informe devuelve
// en un solo request. Vista de SÓLO LECTURA — no hay nada que guardar, por eso
// "Volver" no pide confirmación (a diferencia del editor de borrador de
// TrainingModules.jsx, que sí tiene cambios en memoria).
//
// El VEREDICTO es el elemento dominante de la pantalla a propósito: es lo único
// que se mira el 90% de las veces ("¿esta persona puede entrar a planta o no?").
// Todo lo demás es el respaldo de esa respuesta y va deliberadamente más chico,
// y las tres secciones de historial arrancan plegadas para no competir con él.

// El veredicto que calcula el backend (asignaciones/veredicto.ts). Los tres
// primeros estados siempre traen `veredicto.asignacion` (la que dispara el
// estado); los dos últimos no tienen una "culpable" y llevan copy fijo.
//
// PENDIENTE y POR_VENCER comparten el ámbar a propósito: los dos son la zona de
// riesgo, y la distinción entre "no lo rindió nunca" y "lo tiene por vencer" la
// carga el texto, no el color.
//
// El fondo va un escalón más saturado que el resto de la app (la tríada -100 en
// vez del -50 que usan los badges) y el texto en -800: el card es chico, así que
// el peso visual lo tiene que dar el color y no el tamaño. Es el ÚNICO bloque de
// color de la pantalla — por eso se distingue aunque el nombre de la persona,
// arriba, esté en una tipografía más grande.
const VEREDICTO = {
  NO_HABILITADO: {
    titulo: 'No habilitado',
    detalle: (modulo) => `Tiene ${modulo} vencido`,
    card: 'bg-red-100 border-red-200',
    titleColor: 'text-red-800',
    textColor: 'text-red-800',
    dot: 'bg-red-600',
  },
  PENDIENTE: {
    titulo: 'Pendiente',
    detalle: (modulo) => `No rindió ${modulo}`,
    card: 'bg-amber-100 border-amber-200',
    titleColor: 'text-amber-800',
    textColor: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  POR_VENCER: {
    titulo: 'Por vencer',
    detalle: (modulo) => `${modulo} vence pronto`,
    card: 'bg-amber-100 border-amber-200',
    titleColor: 'text-amber-800',
    textColor: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  EN_REGLA: {
    titulo: 'En regla',
    detalle: () => 'Todas sus capacitaciones están al día',
    card: 'bg-emerald-100 border-emerald-200',
    titleColor: 'text-emerald-800',
    textColor: 'text-emerald-800',
    dot: 'bg-emerald-600',
  },
  SIN_OBLIGACIONES: {
    titulo: 'Sin obligaciones',
    detalle: () => 'No tiene capacitaciones asignadas',
    // El único que NO sube de escalón: ya estaba en -100 (slate-50 se confunde
    // con el fondo de la app). Es el estado sin señal y tiene que seguir siendo
    // el más apagado del set, por eso también conserva el detalle en -600.
    card: 'bg-slate-100 border-slate-300',
    titleColor: 'text-slate-800',
    textColor: 'text-slate-600',
    dot: 'bg-slate-400',
  },
}

// Estado de vigencia de UNA asignación (Story 8). Mismo criterio de color que
// el veredicto: rojo lo que bloquea, ámbar la zona de riesgo, verde lo que está
// al día. Vive acá y no en core/format/badges.js porque hoy esta es la única
// pantalla que lo usa — si mañana lo consume otra, se muda igual que roleBadge.
const VENCIMIENTO = {
  VENCIDO:     { label: 'Vencido',     cls: 'bg-red-50 text-red-600' },
  SIN_APROBAR: { label: 'Sin aprobar', cls: 'bg-amber-50 text-amber-700' },
  POR_VENCER:  { label: 'Por vencer',  cls: 'bg-amber-50 text-amber-700' },
  VIGENTE:     { label: 'Vigente',     cls: 'bg-emerald-50 text-emerald-600' },
}

const ACCION = {
  CREATE: { label: 'Alta',        cls: 'bg-emerald-50 text-emerald-600' },
  UPDATE: { label: 'Modificación', cls: 'bg-blue-50 text-blue-600' },
  DELETE: { label: 'Baja',        cls: 'bg-red-50 text-red-600' },
}

const ENTIDAD = {
  Vinculacion: 'Vinculación',
  VinculacionPuestoCentro: 'Puesto y centro de costo',
}

// Las dos PK internas que el snapshot del backend incluye y que acá no
// significan nada: `id` es la fila de Vinculacion y `usuarioId` la persona
// cuyo historial ya se está mirando. Son `Int autoincrement`, así que salían
// como "ID: — → 7" y "Usuario: — → 42" (el spike de la Story 1 del sprint
// 13-08 arrancó justamente por eso). Se esconden en el RENDER y no en el
// backend: el AuditLog las tiene que seguir guardando.
// Ojo: esto NO es "ocultar todo lo que termine en Id" — organizacionId,
// puestoId y centroCostoId sí se muestran, traducidos a nombre por valorLegible.
const CAMPOS_OCULTOS = new Set(['id', 'usuarioId'])

// Nombres de campo del diff en castellano. Las claves son las columnas reales
// que audita el backend (UsuariosService.vinculacionEscalar / parEscalar).
const CAMPO = {
  organizacionId: 'Organización',
  rol: 'Rol',
  activa: 'Activa',
  activo: 'Activo',
  deletedAt: 'Baja',
  puestoId: 'Puesto',
  centroCostoId: 'Centro de costo',
  principal: 'Principal',
}

const fecha = (v) => (v ? new Date(v).toLocaleDateString('es-AR') : '—')
const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-AR') : '—')
const capitalizar = (s) => s.charAt(0) + s.slice(1).toLowerCase()

const chip = (cls) => `px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`

export default function HistorialUsuario({
  usuarioId,
  onVolver,
  // Catálogos ya cargados por Usuarios.jsx — llegan por prop en vez de pedirse
  // de nuevo. Sirven para traducir los ids crudos que guarda el AuditLog
  // (puestoId/centroCostoId son UUID, organizacionId un entero) a nombres.
  puestos = [],
  centrosCosto = [],
  organizaciones = [],
}) {
  const [informe, setInforme] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showRevocadas, setShowRevocadas] = useState(false)
  const [showSesiones, setShowSesiones] = useState(false)
  const [showAudit, setShowAudit] = useState(false)

  const fetchInforme = async () => {
    const data = await usuariosApi.informe(usuarioId)
    setInforme(data)
  }

  const reintentar = async () => {
    setLoading(true)
    setError(null)
    try {
      await fetchInforme()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInforme()
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId])

  // Id → nombre para el diff del audit log. Se arma con el catálogo COMPLETO
  // (incluye los dados de baja), que es justamente lo que hace falta para poder
  // nombrar un puesto que se desactivó después del cambio que se está leyendo.
  const nombrePorId = useMemo(
    () => ({
      puestoId: new Map(puestos.map((p) => [p.id, p.nombre])),
      centroCostoId: new Map(centrosCosto.map((c) => [c.id, c.nombre])),
      organizacionId: new Map(organizaciones.map((o) => [o.id, o.nombre])),
    }),
    [puestos, centrosCosto, organizaciones],
  )

  // Un valor del diff, legible. Si el id no está en el catálogo (se borró del
  // todo) cae al valor crudo en vez de romper: es una vista de auditoría, más
  // vale un UUID que un hueco.
  const valorLegible = (campo, valor) => {
    if (valor === null || valor === undefined) return '—'
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
    const catalogo = nombrePorId[campo]
    if (catalogo) return catalogo.get(valor) ?? String(valor)
    if (campo === 'rol') return capitalizar(String(valor))
    if (campo === 'deletedAt') return fechaHora(valor)
    return String(valor)
  }

  const vigentes = useMemo(
    () => (informe?.asignaciones ?? []).filter((a) => !a.revocadaAt),
    [informe],
  )
  const revocadas = useMemo(
    () => (informe?.asignaciones ?? []).filter((a) => a.revocadaAt),
    [informe],
  )

  const volver = (
    <Button variant="secondary" size="sm" onClick={onVolver}>
      ← Volver a Usuarios
    </Button>
  )

  if (loading) {
    return (
      <div className="space-y-5">
        {volver}
        <p className="text-slate-400 text-sm">Cargando…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-5">
        {volver}
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between">
          <span>No se pudo cargar el historial: {error}</span>
          <Button variant="secondary" size="sm" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const { usuario, veredicto, sesiones, auditLog } = informe
  const vinculacion = usuario.vinculacion
  const pares = vinculacion?.pares ?? []
  const v = VEREDICTO[veredicto.estado] ?? VEREDICTO.SIN_OBLIGACIONES
  const moduloDelVeredicto = veredicto.asignacion?.moduloNombre ?? ''

  const vigentesColumns = [
    {
      key: 'modulo',
      label: 'Módulo',
      render: (_, row) => <span className="text-slate-900 font-medium">{row.modulo.nombre}</span>,
    },
    {
      key: 'origen',
      label: 'Origen',
      render: (val) => (
        <span className={chip(origenBadge[val] ?? 'bg-slate-100 text-slate-500')}>
          {val === 'AUTOMATICA' ? 'Automática' : 'Manual'}
        </span>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (_, row) => {
        const est = VENCIMIENTO[row.vencimiento.estado]
        return est ? (
          <span className={chip(est.cls)}>{est.label}</span>
        ) : (
          <span className="text-slate-400">—</span>
        )
      },
    },
    {
      key: 'aprobadaEn',
      label: 'Aprobada el',
      render: (_, row) => (
        <span className="text-slate-500 text-sm">{fecha(row.vencimiento.aprobadaEn)}</span>
      ),
    },
    {
      key: 'venceEl',
      label: 'Vence el',
      render: (_, row) => (
        <span className="text-slate-500 text-sm">
          {/* venceEl null con una aprobación hecha = el módulo no tiene
              vigenciaMeses cargada, o sea que no vence nunca. */}
          {row.vencimiento.venceEl
            ? fecha(row.vencimiento.venceEl)
            : row.vencimiento.aprobadaEn
              ? 'No vence'
              : '—'}
        </span>
      ),
    },
  ]

  const revocadasColumns = [
    {
      key: 'modulo',
      label: 'Módulo',
      render: (_, row) => <span className="text-slate-700">{row.modulo.nombre}</span>,
    },
    {
      key: 'origen',
      label: 'Origen',
      render: (val) => (
        <span className={chip(origenBadge[val] ?? 'bg-slate-100 text-slate-500')}>
          {val === 'AUTOMATICA' ? 'Automática' : 'Manual'}
        </span>
      ),
    },
    {
      key: 'revocadaAt',
      label: 'Revocada el',
      render: (val) => <span className="text-slate-500 text-sm">{fecha(val)}</span>,
    },
  ]

  const sesionesColumns = [
    {
      key: 'createdAt',
      label: 'Fecha',
      // createdAt (reloj del SERVIDOR) y no finalizadaEn (reloj del
      // dispositivo): con el modo offline el POST puede llegar horas después y
      // la tablet puede tener la hora desfasada. Es el mismo criterio con el
      // que el backend calcula la vigencia.
      render: (val) => <span className="text-slate-500 text-sm">{fecha(val)}</span>,
    },
    {
      key: 'modulo',
      label: 'Módulo',
      render: (_, row) => (
        <span className="text-slate-900 font-medium">{row.moduloVersion.modulo.nombre}</span>
      ),
    },
    {
      key: 'version',
      label: 'Versión',
      render: (_, row) => (
        <span className="font-mono text-slate-500 text-sm">
          {formatVersionNumero(row.moduloVersion)}
        </span>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      render: (_, row) => (
        <span className="text-slate-700 text-sm">
          <span className="font-mono">{row.correctas}/{row.total}</span>
          <span className="text-slate-400"> · {row.porcentaje}%</span>
        </span>
      ),
    },
    {
      key: 'aprobada',
      label: 'Resultado',
      render: (val) => (
        <span className={chip(val ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
          {val ? 'Aprobado' : 'Desaprobado'}
        </span>
      ),
    },
  ]

  const seccionPlegable = (abierta, toggle, label, count) => (
    <button
      type="button"
      onClick={toggle}
      className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1.5"
    >
      <span className="text-xs">{abierta ? '▾' : '▸'}</span>
      {label} ({count})
    </button>
  )

  return (
    <div className="space-y-5">
      {volver}

      {/* Cabecera — identidad y pertenencia. Deliberadamente compacta: el
          protagonista de la pantalla es el veredicto de abajo. */}
      <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-slate-900 font-bold text-xl">
            {usuario.nombre} {usuario.apellido}
          </h2>
          {vinculacion?.rol && (
            <span
              className={`${chip(roleBadge[vinculacion.rol] ?? 'bg-slate-100 text-slate-600')} capitalize`}
            >
              {vinculacion.rol.toLowerCase()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <span className="text-slate-500 font-mono">{usuario.dni}</span>
          <span className="text-slate-500">{vinculacion?.organizacion?.nombre ?? '—'}</span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
            Puestos y centros de costo
          </p>
          {pares.length === 0 ? (
            <p className="text-slate-400 text-sm">Sin pares cargados.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pares.map((par, i) => (
                <span
                  key={i}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    par.activo ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400 line-through'
                  }`}
                >
                  {par.puesto.nombre} · {par.centroCosto.nombre}
                  {par.principal && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-400">
                      principal
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* VEREDICTO — el bloque dominante de la pantalla. */}
      <div className={`border rounded-lg p-4 max-w-2xl ${v.card}`}>
        <div className="flex items-center gap-4">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${v.dot}`} />
          <div>
            <p className={`text-lg font-bold leading-tight ${v.titleColor}`}>{v.titulo}</p>
            <p className={`text-sm mt-1 ${v.textColor}`}>{v.detalle(moduloDelVeredicto)}</p>
          </div>
        </div>
      </div>

      {/* Asignaciones vigentes — el respaldo del veredicto. */}
      <div className="space-y-2">
        <h3 className="text-slate-700 font-semibold text-sm">
          Capacitaciones asignadas ({vigentes.length})
        </h3>
        <Table columns={vigentesColumns} data={vigentes} />
      </div>

      {/* Revocadas: aparte y plegadas — ya no le corresponden a la persona y no
          cuentan para el veredicto, pero el historial importa para ISO 9001. */}
      <div className="space-y-2">
        {seccionPlegable(showRevocadas, () => setShowRevocadas((s) => !s), 'Revocadas', revocadas.length)}
        {showRevocadas && <Table columns={revocadasColumns} data={revocadas} />}
      </div>

      <div className="space-y-2">
        {seccionPlegable(showSesiones, () => setShowSesiones((s) => !s), 'Historial de rendiciones', sesiones.length)}
        {showSesiones && <Table columns={sesionesColumns} data={sesiones} />}
      </div>

      <div className="space-y-2">
        {seccionPlegable(showAudit, () => setShowAudit((s) => !s), 'Historial de cambios', auditLog.length)}
        {showAudit && (
          <div className="bg-white border border-slate-200 rounded shadow-sm divide-y divide-slate-200/70">
            {auditLog.length === 0 ? (
              <p className="px-4 py-10 text-center text-slate-400 text-[11px] font-mono uppercase tracking-widest">
                — Sin registros —
              </p>
            ) : (
              auditLog.map((log) => {
                const accion = ACCION[log.accion] ?? { label: log.accion, cls: 'bg-slate-100 text-slate-600' }
                // Los pares donde nada cambió son ruido: los CREATE traen
                // cosas como `deletedAt: null → null`. Salvo las PK internas
                // (ver CAMPOS_OCULTOS), el resto se muestra completo.
                const cambios = Object.entries(log.diff ?? {}).filter(
                  ([campo, { antes, despues }]) =>
                    !CAMPOS_OCULTOS.has(campo) && antes !== despues,
                )
                return (
                  <div key={log.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className={chip(accion.cls)}>{accion.label}</span>
                      <span className="text-slate-700 font-medium">
                        {ENTIDAD[log.entidad] ?? log.entidad}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">{fechaHora(log.createdAt)}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">por {log.actor}</span>
                    </div>
                    {cambios.length > 0 && (
                      <ul className="space-y-0.5">
                        {cambios.map(([campo, { antes, despues }]) => (
                          <li key={campo} className="text-sm text-slate-600">
                            <span className="text-slate-400">{CAMPO[campo] ?? campo}:</span>{' '}
                            <span>{valorLegible(campo, antes)}</span>
                            <span className="text-slate-400 mx-1.5">→</span>
                            <span className="font-medium text-slate-800">
                              {valorLegible(campo, despues)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
