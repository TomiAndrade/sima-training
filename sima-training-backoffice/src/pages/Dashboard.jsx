import { useEffect, useState } from 'react'
import Button from '../components/Button'
import { organizacionesApi } from '../core/api/organizaciones'
import { modulosApi } from '../core/api/modulos'
import { resumenApi } from '../core/api/resumen'
import { healthApi } from '../core/api/health'
import { estadoModulo } from '../sima-check/components/bancoModulo'

// Esta pantalla es el panel de la PLATAFORMA (SIMA TRAINING), no el de un
// producto. Por eso NO repite lo que ya responde el Resumen de SIMA CHECK
// ("¿cuánta de mi gente está habilitada?"): acá van las organizaciones, la
// gente y qué productos existen. Lo de cada producto se ve entrando al
// producto — la card de abajo es un adelanto de tres números, no un dashboard.
//
// Antes tenía cuatro KPIs mockeados, una "Actividad reciente" con nombres
// inventados y un "Estado del sistema" que **siempre** decía OPERATIVO. Ese
// último era el peor de todos: un panel que nunca puede dar mala noticia da
// confianza falsa, que es peor que no tener panel.

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">{children}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  )
}

function StatusDot({ ok }) {
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
  )
}

function Kpi({ label, value, nota }) {
  return (
    <div className="bg-white border border-slate-200 rounded p-4 relative overflow-hidden shadow-sm">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-600/40 via-slate-300 to-transparent" />
      <div className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest mb-2">{label}</div>
      <div className="text-3xl font-bold text-slate-900 font-mono leading-none">{value}</div>
      {nota && <div className="text-slate-400 text-[10px] mt-2">{nota}</div>}
    </div>
  )
}

export default function Dashboard({ navigate }) {
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTodo = async () => {
    // `allSettled` y no `all`: el estado del sistema es justamente lo que
    // interesa cuando algo falla, así que un backend caído tiene que poder
    // pintarse como "caído" en vez de tumbar la pantalla entera.
    const [orgs, mods, resumen, health] = await Promise.allSettled([
      organizacionesApi.list(),
      modulosApi.list(),
      resumenApi.simaCheck(),
      healthApi.check(),
    ])
    const valor = (r, fallback) => (r.status === 'fulfilled' ? r.value : fallback)
    setDatos({
      organizaciones: valor(orgs, []),
      modulos: valor(mods, []),
      resumen: valor(resumen, null),
      health: valor(health, null),
      // Si ni el health respondió, no es que la base esté mal: no hay backend.
      apiCaida: health.status === 'rejected',
    })
  }

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTodo()
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <p className="text-slate-400 text-[11px] font-mono uppercase tracking-widest text-center py-10">
        — Cargando… —
      </p>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 max-w-6xl">
        No se pudo cargar el panel: {error}
      </div>
    )
  }

  const { organizaciones, modulos, resumen, health, apiCaida } = datos

  const activas = organizaciones.filter((o) => o.activa)
  const clientes = activas.filter((o) => o.tipo === 'CLIENTE').length
  const subcontratistas = activas.filter((o) => o.tipo === 'SUBCONTRATISTA').length
  const personas = resumen?.habilitacion.total ?? 0
  const modulosActivos = modulos.filter((m) => estadoModulo(m) === 'activo').length

  // Adelanto de SIMA CHECK para su card. Sale del MISMO endpoint que el
  // Resumen, así que los dos números no pueden divergir.
  const alcanzadas = resumen
    ? resumen.habilitacion.total - resumen.habilitacion.SIN_OBLIGACIONES
    : 0
  const noHabilitados = resumen?.habilitacion.NO_HABILITADO ?? 0

  // Sólo se listan servicios que se CHEQUEAN de verdad. La versión anterior
  // tenía además "Servicios de plataforma" e "Integraciones externas", que no
  // consultaban nada — la segunda incluso decía ADVERTENCIA fija, o sea que
  // mostraba un problema inventado.
  const servicios = [
    { label: 'API', ok: !apiCaida },
    { label: 'Base de datos', ok: health?.db === 'ok' },
  ]

  return (
    <div className="space-y-7 max-w-6xl">

      <div>
        <SectionHeader>Resumen Operacional</SectionHeader>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {/* "Organizaciones cliente" y no "Clientes" a secas: un *cliente*, en
              el sentido del producto, va a ser una PERSONA (un usuario con rol
              AUDITOR) que mira los datos de ciertos subcontratistas — no la
              empresa. Estas dos tarjetas cuentan empresas, y el rótulo lo dice
              para no ocupar el nombre que va a significar otra cosa. */}
          <Kpi
            label="Organizaciones cliente"
            value={clientes}
            nota={clientes === 0 ? 'Todavía no se cargó ninguna' : undefined}
          />
          <Kpi label="Organizaciones subcontratistas" value={subcontratistas} />
          <Kpi label="Personas en el sistema" value={personas} />
          <Kpi label="Módulos activos" value={modulosActivos} />
        </div>
      </div>

      <div>
        <SectionHeader>Estado del Sistema</SectionHeader>
        <div className="bg-white border border-slate-200 rounded divide-y divide-slate-200 shadow-sm max-w-md">
          {servicios.map((s) => (
            <div key={s.label} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5">
                <StatusDot ok={s.ok} />
                <span className="text-slate-600 text-xs">{s.label}</span>
              </div>
              <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider ${s.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                {s.ok ? 'Operativo' : 'Caído'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader>Productos de la Plataforma</SectionHeader>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          <div className="bg-white border border-slate-200 rounded p-5 flex flex-col gap-4 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-px bg-red-600/60" />
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-slate-900 font-semibold text-sm tracking-wide">SIMA CHECK</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-mono font-semibold uppercase tracking-wider">
                    Activo
                  </span>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed">Capacitaciones y evaluaciones industriales</p>
              </div>
              <div className="w-8 h-8 bg-red-50 border border-red-200 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 font-bold text-[11px] font-mono">SC</span>
              </div>
            </div>
            <div className="flex gap-4">
              <div>
                <div className="text-slate-400 text-[10px] uppercase tracking-widest">Módulos</div>
                <div className="text-slate-900 font-mono font-bold text-lg">{modulosActivos}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] uppercase tracking-widest">Alcanzadas</div>
                <div className="text-slate-900 font-mono font-bold text-lg">{alcanzadas}</div>
              </div>
              <div>
                {/* El número que hace clickear: si hay gente no habilitada, se
                    pinta en rojo. Sale del mismo endpoint que el Resumen. */}
                <div className="text-slate-400 text-[10px] uppercase tracking-widest">No habilitados</div>
                <div className={`font-mono font-bold text-lg ${noHabilitados > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {noHabilitados}
                </div>
              </div>
            </div>
            <Button className="mt-auto w-full justify-center" onClick={() => navigate('sima-check-overview')}>
              Abrir SIMA CHECK →
            </Button>
          </div>

          {[
            { code: 'SI', name: 'SIMA INSPECTIONS', desc: 'Gestión de inspecciones en campo', eta: 'Q3 2026' },
            { code: 'SA', name: 'SIMA AUDITS', desc: 'Auditorías de seguridad y calidad', eta: 'Q4 2026' },
          ].map((prod) => (
            <div key={prod.code} className="bg-slate-50 border border-slate-200 rounded p-5 flex flex-col gap-4 opacity-60">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-600 font-semibold text-sm tracking-wide">{prod.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-500 text-[10px] font-mono font-semibold uppercase tracking-wider">
                      Roadmap
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">{prod.desc}</p>
                </div>
                <div className="w-8 h-8 bg-slate-100 border border-slate-200 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-slate-400 font-bold text-[11px] font-mono">{prod.code}</span>
                </div>
              </div>
              <div className="mt-auto">
                <div className="text-slate-400 text-[10px] uppercase tracking-widest">Disponibilidad estimada</div>
                <div className="text-slate-600 font-mono font-semibold text-sm mt-0.5">{prod.eta}</div>
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  )
}
