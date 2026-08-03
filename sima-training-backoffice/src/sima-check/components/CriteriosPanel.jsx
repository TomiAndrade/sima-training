import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/Button'
import { basesConocimientoApi } from '../../core/api/basesConocimiento'
import { preguntasApi } from '../../core/api/preguntas'
import { claveCriterio } from './bancoModulo'

// Sección "Qué evalúa este módulo": los ModuloVersionCriterio de la versión en
// edición. Un criterio es (base de conocimiento, nivel opcional) y declara el
// TEMA que se evalúa, en vez de enumerar preguntas una por una.
//
// Se guarda con su propio botón explícito ("Guardar criterios"), separado del
// staging de preguntas de TrainingModules.jsx — ver el comentario de
// handleGuardarCriterios allá. Acá adentro no hay red salvo la lectura del
// catálogo y el conteo de cada fila: editar filas es estado local, y el padre
// decide cuándo persistir.

const inputCls =
  'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

// Valor del <select> de nivel cuando el criterio es "cualquier nivel de la
// base". No puede ser '' a secas para poder distinguirlo del placeholder.
const CUALQUIER_NIVEL = ''

// Badge de cuántas preguntas del banco matchea un criterio. En ámbar cuando da
// cero: no es un error (declarar el tema antes de cargar las preguntas es un
// flujo válido y el backend lo acepta), pero sí algo que conviene ver.
function ConteoBadge({ ids }) {
  if (!Array.isArray(ids)) {
    return <span className="text-slate-400 text-xs font-mono">contando...</span>
  }
  const conteo = ids.length
  if (conteo === 0) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-amber-50 text-amber-600 border-amber-200 whitespace-nowrap">
        0 preguntas
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-indigo-50 text-indigo-600 border-indigo-200 whitespace-nowrap">
      {conteo} pregunta{conteo !== 1 ? 's' : ''}
    </span>
  )
}

// Vista de solo lectura: la usa la versión publicada y el detalle del historial.
function CriteriosReadOnly({ criterios }) {
  if (criterios.length === 0) {
    return (
      <div className="px-4 py-5 text-center text-slate-400 text-[11px] font-mono uppercase tracking-widest">
        — Sin criterios: el contenido se armó eligiendo preguntas a mano —
      </div>
    )
  }
  return (
    <div className="divide-y divide-slate-100">
      {criterios.map((c) => (
        <div key={c.id} className="px-4 py-2.5 flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-indigo-50 text-indigo-600 border-indigo-200">
            {c.base?.nombre ?? '—'}
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-slate-50 text-slate-500 border-slate-200">
            {c.nivel?.nombre ?? 'Cualquier nivel'}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function CriteriosPanel({
  criterios,
  readOnly,
  onChange,
  onGuardar,
  guardando,
  error,
  dirty,
}) {
  const [bases, setBases] = useState([])

  // Sólo las bases activas: acá se elige qué evaluar de ahora en más, y ofrecer
  // una base dada de baja sería ofrecer clasificar contra algo que ya no se usa.
  // Mismo criterio que NuevaPreguntaModal.
  useEffect(() => {
    if (readOnly) return
    basesConocimientoApi.list({ activa: true }).then(setBases).catch(() => {})
  }, [readOnly])

  // Preguntas que matchea cada criterio, contra el MISMO filtro que usa el
  // backend para materializar el pool (activa=true + base + nivel opcional). No
  // hay endpoint de dry-run justamente porque este ya responde lo mismo.
  //
  // Se guardan los IDS y no un número: dos criterios pueden pisarse ("cualquier
  // nivel de Seguridad" + "Seguridad-Básico"), y el backend unifica en un Set.
  // Sumar los conteos por fila daría un total inflado que no coincide con los
  // pivots que van a quedar.
  const [conteos, setConteos] = useState({})
  const clavesPedidas = useMemo(
    () => criterios.filter((c) => c.baseConocimientoId).map(claveCriterio).join('|'),
    [criterios],
  )
  useEffect(() => {
    if (readOnly) return
    let cancelado = false
    const completos = criterios.filter((c) => c.baseConocimientoId)
    Promise.all(
      completos.map((c) =>
        preguntasApi
          .list({ baseId: c.baseConocimientoId, nivelId: c.nivelId || undefined, activa: true })
          .then((ps) => [claveCriterio(c), ps.map((p) => p.id)])
          .catch(() => [claveCriterio(c), null]),
      ),
    ).then((pares) => {
      if (!cancelado) setConteos(Object.fromEntries(pares))
    })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavesPedidas, readOnly])

  const agregarFila = () => {
    onChange([...criterios, { baseConocimientoId: '', nivelId: null }])
  }

  const quitarFila = (i) => {
    onChange(criterios.filter((_, idx) => idx !== i))
  }

  // Cambiar de base invalida el nivel elegido: un nivel pertenece a una base y
  // el backend rechaza el cruce con un 400.
  const cambiarBase = (i, baseConocimientoId) => {
    onChange(
      criterios.map((c, idx) =>
        idx === i ? { ...c, baseConocimientoId, nivelId: null } : c,
      ),
    )
  }

  const cambiarNivel = (i, valor) => {
    onChange(
      criterios.map((c, idx) =>
        idx === i ? { ...c, nivelId: valor === CUALQUIER_NIVEL ? null : valor } : c,
      ),
    )
  }

  // Repetidos: se marcan en la fila en vez de bloquear el guardado con un
  // mensaje suelto, para que se vea CUÁL sobra.
  const repetidos = useMemo(() => {
    const vistos = new Set()
    const dup = new Set()
    for (const c of criterios) {
      if (!c.baseConocimientoId) continue
      const k = claveCriterio(c)
      if (vistos.has(k)) dup.add(k)
      vistos.add(k)
    }
    return dup
  }, [criterios])

  const incompletos = criterios.some((c) => !c.baseConocimientoId)
  const puedeGuardar = dirty && !incompletos && repetidos.size === 0 && !guardando

  // Unión, no suma: es lo que va a quedar como pivots (ver el comentario del
  // efecto de arriba).
  const totalPreguntas = useMemo(() => {
    const union = new Set()
    for (const c of criterios) {
      const ids = conteos[claveCriterio(c)]
      if (Array.isArray(ids)) ids.forEach((id) => union.add(id))
    }
    return union.size
  }, [criterios, conteos])

  return (
    <div className="border border-slate-200 rounded bg-white">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">
            Qué evalúa este módulo
          </span>
          <p className="text-slate-400 text-[11px] mt-0.5">
            {readOnly
              ? 'Los temas y niveles con los que se armó esta versión.'
              : 'Elegí el tema y el nivel. Al guardar, las preguntas del banco que correspondan se suman al módulo.'}
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={agregarFila}>
              + Agregar criterio
            </Button>
            <Button size="sm" onClick={onGuardar} disabled={!puedeGuardar}>
              {guardando ? 'Guardando...' : 'Guardar criterios'}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 text-red-700 text-xs">{error}</div>
      )}

      {readOnly ? (
        <CriteriosReadOnly criterios={criterios} />
      ) : criterios.length === 0 ? (
        <div className="px-4 py-5 text-center text-slate-400 text-[11px] font-mono uppercase tracking-widest">
          — Sin criterios: las preguntas se eligen a mano desde el banco —
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {criterios.map((c, i) => {
            const base = bases.find((b) => b.id === c.baseConocimientoId) ?? null
            const niveles = base?.niveles ?? []
            const duplicada = c.baseConocimientoId && repetidos.has(claveCriterio(c))
            return (
              <div key={i} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <select
                    className={inputCls}
                    value={c.baseConocimientoId}
                    onChange={(e) => cambiarBase(i, e.target.value)}
                  >
                    <option value="">Elegí el tema...</option>
                    {bases.map((b) => (
                      <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                  </select>
                  <select
                    className={inputCls}
                    value={c.nivelId ?? CUALQUIER_NIVEL}
                    onChange={(e) => cambiarNivel(i, e.target.value)}
                    disabled={!base}
                  >
                    <option value={CUALQUIER_NIVEL}>
                      {!base
                        ? 'Elegí primero el tema...'
                        : niveles.length === 0
                          ? 'Esta base no tiene escala cargada'
                          : 'Cualquier nivel'}
                    </option>
                    {niveles.map((n) => (
                      <option key={n.id} value={n.id}>{n.nombre}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.baseConocimientoId && <ConteoBadge ids={conteos[claveCriterio(c)]} />}
                    <Button variant="danger" size="sm" onClick={() => quitarFila(i)}>Quitar</Button>
                  </div>
                </div>
                {duplicada && (
                  <p className="text-amber-600 text-xs">
                    Este criterio está repetido: el mismo tema con el mismo nivel ya figura más arriba.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!readOnly && criterios.length > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-200 text-slate-400 text-[11px] font-mono">
          {totalPreguntas} pregunta{totalPreguntas !== 1 ? 's' : ''} del banco entran por estos criterios
          {incompletos && ' · hay criterios sin tema elegido'}
        </div>
      )}
    </div>
  )
}
