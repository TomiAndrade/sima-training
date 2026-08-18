import { useEffect, useState } from 'react'
import StatCard from '../../components/StatCard'
import Button from '../../components/Button'
import { modulosApi } from '../../core/api/modulos'
import { resumenApi } from '../../core/api/resumen'
import { estadoModulo } from '../components/bancoModulo'

// Los cuatro estados de habilitación que se muestran como tarjeta, en orden de
// gravedad. SIN_OBLIGACIONES queda afuera a propósito: es gente sin ninguna
// capacitación asignada (típicamente cuentas internas), y mezclarla con "al
// día" inflaría el número que más se mira. Se muestra aparte, como contexto.
const ESTADOS = [
  {
    id: 'NO_HABILITADO',
    label: 'No habilitados',
    ayuda: 'Tienen al menos una capacitación vencida',
    tono: 'text-red-600',
  },
  {
    id: 'PENDIENTE',
    label: 'Capacitación pendiente',
    ayuda: 'Tienen algo asignado que nunca aprobaron',
    tono: 'text-amber-600',
  },
  {
    id: 'POR_VENCER',
    label: 'Por vencer',
    ayuda: 'Su aprobación vence pronto',
    tono: 'text-amber-600',
  },
  {
    id: 'EN_REGLA',
    label: 'Al día',
    ayuda: 'Todas sus capacitaciones vigentes',
    tono: 'text-emerald-600',
  },
]

const fecha = (v) => (v ? new Date(v).toLocaleDateString('es-AR') : '—')

// Gráfico de barras contra datos reales. Antes comparaba un array literal de 4
// nombres de módulo escritos a mano en este archivo — módulos que además ya no
// existen, porque el seed dejó de crearlos.
function ApprovalChart({ datos }) {
  const chartH = 140

  if (datos.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-400 text-[11px] font-mono uppercase tracking-widest" style={{ height: chartH + 40 }}>
        — Todavía no hay evaluaciones rendidas —
      </div>
    )
  }

  return (
    <div className="flex items-end justify-around gap-4 pt-4" style={{ height: chartH + 40 }}>
      {datos.map((m) => {
        const barH = Math.round((m.porcentaje / 100) * chartH)
        const color = m.porcentaje >= 70 ? '#059669' : '#d97706'
        return (
          <div key={m.moduloId} className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-semibold font-mono" style={{ color }}>{m.porcentaje}%</span>
            <div
              className="w-full rounded-t transition-all duration-700"
              style={{ height: barH, backgroundColor: color, minHeight: 4 }}
              // El detalle va en el title y no debajo: con nombres de módulo
              // reales (largos y parecidos entre sí) no entra en la etiqueta.
              title={`${m.moduloNombre}: ${m.aprobadas} de ${m.sesiones} aprobadas`}
            />
            <span className="text-slate-400 text-[10px] text-center leading-tight uppercase tracking-wide line-clamp-2 w-full">
              {m.moduloNombre}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">{children}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  )
}

export default function Overview() {
  const [resumen, setResumen] = useState(null)
  const [modulos, setModulos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Refresco manual con estado propio, mismo criterio que HistorialUsuario: no
  // reusa `loading`/`error`, que reemplazan la pantalla entera. Refrescar no
  // puede dejar en blanco un resumen que se estaba leyendo.
  const [refrescando, setRefrescando] = useState(false)
  const [errorRefresco, setErrorRefresco] = useState(null)

  // Dos requests y no uno: "Módulos activos" se sigue derivando de
  // `GET /modulos` con `estadoModulo`, el MISMO helper que usa la pantalla
  // Módulos. Meter ese conteo en el endpoint de resumen habría duplicado una
  // regla sutil (qué versión es la "vigente") en un segundo lugar, y el día que
  // divergieran las dos pantallas mostrarían números distintos de lo mismo.
  const fetchTodo = async () => {
    const [r, mods] = await Promise.all([resumenApi.simaCheck(), modulosApi.list()])
    setResumen(r)
    setModulos(mods)
  }

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTodo()
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const refrescar = async () => {
    setRefrescando(true)
    setErrorRefresco(null)
    try {
      await fetchTodo()
    } catch (err) {
      setErrorRefresco(err.message)
    } finally {
      setRefrescando(false)
    }
  }

  const reintentar = async () => {
    setLoading(true)
    setError(null)
    try {
      await fetchTodo()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <p className="text-slate-400 text-[11px] font-mono uppercase tracking-widest text-center py-10">
        — Cargando… —
      </p>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between gap-3 flex-wrap max-w-6xl">
        <span>No se pudo cargar el resumen: {error}</span>
        <Button variant="secondary" size="sm" onClick={reintentar}>Reintentar</Button>
      </div>
    )
  }

  const { habilitacion, aprobacion, porModulo, recientes } = resumen
  const activeModules = modulos.filter((m) => estadoModulo(m) === 'activo').length

  return (
    <div className="space-y-7 max-w-6xl">

      <div className="flex items-center justify-end">
        <Button variant="secondary" size="sm" onClick={refrescar} disabled={refrescando}>
          {refrescando ? 'Actualizando…' : '↻ Actualizar'}
        </Button>
      </div>

      {/* Un refresco fallido no se lleva puesto el resumen que ya está en
          pantalla: se avisa acá y abajo siguen los últimos datos que llegaron. */}
      {errorRefresco && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <span>No se pudo actualizar: {errorRefresco}. Seguís viendo los datos de la última carga.</span>
          <Button variant="secondary" size="sm" onClick={refrescar} disabled={refrescando}>Reintentar</Button>
        </div>
      )}

      {/* Habilitación de la nómina — el bloque dominante: es la pregunta que
          esta pantalla existe para responder ("¿cuánta de mi gente puede
          trabajar hoy?"). Los conteos son de PERSONAS, no de asignaciones:
          alguien con tres módulos vencidos es una persona no habilitada, no
          tres. */}
      <div>
        <SectionHeader>Habilitación de la nómina</SectionHeader>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {ESTADOS.map((e) => (
            <StatCard
              key={e.id}
              label={e.label}
              value={habilitacion[e.id]}
              delta={e.ayuda}
            />
          ))}
        </div>
        <p className="text-slate-400 text-xs mt-2">
          Sobre {habilitacion.total} personas registradas
          {habilitacion.SIN_OBLIGACIONES > 0 && (
            <> · {habilitacion.SIN_OBLIGACIONES} sin capacitaciones asignadas</>
          )}
        </p>
      </div>

      <div>
        <SectionHeader>Actividad</SectionHeader>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          <StatCard label="Módulos activos" value={activeModules} />
          <StatCard
            label="% Aprobación general"
            // null (nadie rindió todavía) se muestra como "—" y no como 0%:
            // "0%" se leería como "rinden y desaprueban todos".
            value={aprobacion.porcentaje === null ? '—' : `${aprobacion.porcentaje}%`}
            delta={`${aprobacion.aprobadas} de ${aprobacion.sesiones} evaluaciones`}
            deltaPositive={aprobacion.porcentaje !== null && aprobacion.porcentaje >= 70}
          />
          <StatCard label="Evaluaciones rendidas" value={aprobacion.sesiones} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        <div>
          <SectionHeader>Aprobación por Módulo</SectionHeader>
          <div className="bg-white border border-slate-200 rounded p-5 shadow-sm">
            <p className="text-slate-400 text-[10px] font-mono uppercase tracking-widest mb-4">
              % evaluaciones aprobadas por capacitación
            </p>
            <ApprovalChart datos={porModulo} />
          </div>
        </div>

        <div>
          <SectionHeader>Últimas Evaluaciones</SectionHeader>
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            {recientes.length === 0 ? (
              <p className="text-slate-400 text-[11px] font-mono uppercase tracking-widest text-center py-10">
                — Todavía no hay evaluaciones rendidas —
              </p>
            ) : (
              recientes.map((ev, i) => (
                <div
                  key={ev.id}
                  className={`flex items-center justify-between px-4 py-3 ${i < recientes.length - 1 ? 'border-b border-slate-200/60' : ''} hover:bg-slate-50 transition-colors`}
                >
                  <div className="min-w-0">
                    <p className="text-slate-800 text-sm font-medium truncate">{ev.usuarioNombre}</p>
                    <p className="text-slate-400 text-[10px] font-mono uppercase tracking-wide truncate">
                      {ev.moduloNombre} · {fecha(ev.fecha)}
                    </p>
                  </div>
                  <span className={`ml-3 flex-shrink-0 px-2 py-1 rounded text-[11px] font-bold font-mono border ${
                    ev.aprobada
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {ev.porcentaje}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
