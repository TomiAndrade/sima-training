import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/Button'
import StatCard from '../../components/StatCard'
import Table from '../../components/Table'
import { estadisticasApi, MINIMO_SIGNIFICATIVO } from '../../core/api/estadisticas'
import { preguntasApi } from '../../core/api/preguntas'
import { backendTypeBadge } from '../../core/format/tipoPregunta'
import { VerPreguntaModal } from '../components/BancoPreguntas'

// Estadísticas de CONTENIDO de SIMA CHECK: qué preguntas se fallan, qué temas
// hay que reforzar y dónde.
//
// Tab propio y no un bloque más del Resumen a propósito: el Resumen responde
// "¿cuánta de mi gente está habilitada hoy?" y esto responde "¿qué contenido
// está fallando?". Son dos preguntas con dos lectores distintos — la primera la
// mira HSE todos los días, ésta se mira cuando hay que revisar el banco.
//
// Sin filtros en esta versión, a propósito: hoy el volumen de rendiciones es
// chico y filtrar sobre pocos datos agrega controles que no cambian nada. Los
// ejes naturales cuando haga falta son módulo, base y rango de fechas (y ahí
// hay que decidir contra qué reloj se filtra: `createdAt` del servidor, no
// `finalizadaEn` del dispositivo).

const RANKING_VISIBLE = 15

// Verde arriba del umbral de aprobación por defecto, ámbar abajo. Mismo
// criterio de color que el gráfico del Resumen, para que las dos pantallas
// signifiquen lo mismo.
const colorPorcentaje = (p) => (p >= 70 ? '#059669' : p >= 50 ? '#d97706' : '#dc2626')

const pctTexto = (p) => (p == null ? '—' : `${p}%`)

function SectionHeader({ children, ayuda }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-3">
        <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">
          {children}
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      {ayuda && <p className="text-slate-400 text-xs mt-1.5">{ayuda}</p>}
    </div>
  )
}

// Barra horizontal y no vertical (el gráfico del Resumen es vertical): acá lo
// que se compara son enunciados largos, que no entran en una etiqueta debajo de
// una columna.
function BarraAcierto({ porcentaje, atenuada }) {
  if (porcentaje == null) {
    return <span className="text-slate-300 text-xs font-mono">sin datos</span>
  }
  const color = colorPorcentaje(porcentaje)
  return (
    <div className="flex items-center gap-2 min-w-[7rem]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden">
        <div
          className="h-full rounded"
          style={{
            width: `${porcentaje}%`,
            backgroundColor: color,
            opacity: atenuada ? 0.4 : 1,
          }}
        />
      </div>
      <span
        className="text-xs font-mono font-semibold w-9 text-right"
        style={{ color: atenuada ? '#94a3b8' : color }}
      >
        {porcentaje}%
      </span>
    </div>
  )
}

function seccionPlegable(abierta, toggle, label, count) {
  return (
    <button
      type="button"
      onClick={toggle}
      className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1.5"
    >
      <span className="text-xs">{abierta ? '▾' : '▸'}</span>
      {label} ({count})
    </button>
  )
}

// Lista simple de preguntas, para las dos secciones plegadas del pie.
function ListaPreguntas({ preguntas, vacio, onVer }) {
  if (preguntas.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-slate-400 text-[11px] font-mono uppercase tracking-widest bg-white border border-slate-200 rounded">
        {vacio}
      </p>
    )
  }
  return (
    <div className="bg-white border border-slate-200 rounded shadow-sm divide-y divide-slate-200/70">
      {preguntas.map((p) => (
        <div key={p.preguntaId} className="px-4 py-2.5 flex items-center gap-3">
          <span className="text-slate-700 text-sm flex-1 line-clamp-1">{p.texto}</span>
          {p.base && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-600 font-medium flex-shrink-0">
              {p.base.nombre}
            </span>
          )}
          <span className="text-slate-400 text-xs font-mono flex-shrink-0 w-24 text-right">
            {p.respuestas} resp.
          </span>
          <Button variant="ghost" size="sm" onClick={() => onVer(p.preguntaId)}>
            Ver
          </Button>
        </div>
      ))}
    </div>
  )
}

// Distribución de respuestas de una pregunta: cuántos eligieron cada opción.
// Es lo que distingue una pregunta DIFÍCIL (se falla, pero los errores se
// reparten) de una MAL ARMADA (todos eligen la misma incorrecta, o hay una
// opción que no elige nadie).
function Distribucion({ fila }) {
  // `fila` puede no existir si un refresco trajo un reporte donde esa pregunta
  // ya no aparece (se mandó a papelera y salió del pool, por ejemplo) mientras
  // el detalle estaba abierto.
  if (!fila) return null
  const total = fila.distribucion.reduce((acc, d) => acc + d.veces, 0)
  if (total === 0) {
    return (
      <p className="text-slate-400 text-xs">
        Sin respuestas registradas para esta pregunta.
      </p>
    )
  }

  return (
    <div>
      <SectionHeader ayuda="Cuántas personas eligieron cada opción. Si los errores se concentran todos en la misma opción, esa distractora probablemente sea ambigua.">
        Distribución de respuestas
      </SectionHeader>
      <div className="space-y-2">
        {fila.distribucion.map((d, i) => {
          const porcentaje = Math.round((d.veces / total) * 100)
          return (
            <div key={`${d.valor ?? 'blanco'}-${i}`} className="flex items-center gap-3">
              <span
                className={`text-sm flex-1 truncate ${
                  d.esCorrecta ? 'text-emerald-700 font-medium' : 'text-slate-600'
                }`}
              >
                {d.valor === null ? (
                  <span className="text-amber-600 italic">Sin responder</span>
                ) : (
                  d.valor
                )}
                {d.esCorrecta && (
                  <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide ml-2">
                    ✓ Correcta
                  </span>
                )}
                {/* Un valor que ya no figura entre las opciones de la pregunta.
                    Hoy no debería pasar, pero si pasa se muestra igual: si lo
                    escondiéramos, la distribución no cerraría contra el total y
                    nadie sabría por qué. */}
                {!d.entreOpciones && d.valor !== null && (
                  <span className="text-slate-400 text-[10px] ml-2">
                    (fuera de las opciones actuales)
                  </span>
                )}
              </span>
              <div className="w-40 h-1.5 bg-slate-100 rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${porcentaje}%`,
                    backgroundColor: d.esCorrecta ? '#059669' : '#94a3b8',
                  }}
                />
              </div>
              <span className="text-slate-500 text-xs font-mono w-16 text-right">
                {d.veces} · {porcentaje}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Una fila del ranking, que se expande EN EL LUGAR para mostrar su
// distribución.
//
// No usa `Table` a propósito, aunque el resto de la pantalla sí: una fila que
// se despliega no encaja en columnas. Es el mismo motivo por el que Reglas y
// Bases tampoco lo usan. La versión anterior sí era una `Table` con el detalle
// renderizado DEBAJO de las 15 filas, y eso hacía que abrir el detalle de la
// primera pregunta pintara el panel fuera de la pantalla — se leía como que el
// botón no hacía nada.
function FilaRanking({ fila, abierta, onToggle, onVer }) {
  const pocosDatos = fila.respuestas < MINIMO_SIGNIFICATIVO

  return (
    <div>
      <div className="px-4 py-3 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-slate-800 text-sm line-clamp-2">{fila.texto}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {backendTypeBadge(fila.tipo)}
            {fila.base ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-600 font-medium">
                {fila.base.nombre}
              </span>
            ) : (
              <span className="text-amber-600 text-[11px]">Sin clasificar</span>
            )}
            {fila.nivel && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500">
                {fila.nivel.nombre}
              </span>
            )}
            {fila.activa === false && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-600">
                En papelera
              </span>
            )}
            {pocosDatos && (
              <span className="text-slate-400 text-[11px]">pocos datos</span>
            )}
          </div>
        </div>

        <div className="text-sm flex-shrink-0 w-24 text-right">
          <span className="font-mono font-semibold text-red-600">
            {fila.incorrectas}
          </span>
          <span className="text-slate-400"> de {fila.respuestas}</span>
        </div>

        <div className="w-40 flex-shrink-0 pt-0.5">
          <BarraAcierto porcentaje={fila.porcentajeAcierto} atenuada={pocosDatos} />
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {abierta ? '▾ Ocultar' : '▸ Detalle'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onVer}>
            Ver
          </Button>
        </div>
      </div>

      {abierta && (
        <div className="px-4 pb-4 pt-1 bg-slate-50 border-t border-slate-200">
          <Distribucion fila={fila} />
        </div>
      )}
    </div>
  )
}

// Tabla de un corte por catálogo (centro de costo o puesto).
function TablaCatalogo({ datos, etiqueta }) {
  const columns = [
    {
      key: 'nombre',
      label: etiqueta,
      render: (val) => <span className="text-slate-900 font-medium">{val}</span>,
    },
    {
      key: 'personas',
      label: 'Personas',
      render: (val) => <span className="text-slate-500 text-sm font-mono">{val}</span>,
    },
    {
      key: 'sesiones',
      label: 'Evaluaciones',
      render: (val) => <span className="text-slate-500 text-sm font-mono">{val}</span>,
    },
    {
      key: 'respuestas',
      label: 'Respuestas',
      render: (_, row) => (
        <span className="text-slate-500 text-sm font-mono">
          {row.correctas}/{row.respuestas}
        </span>
      ),
    },
    {
      key: 'porcentaje',
      label: 'Acierto',
      render: (val) => <BarraAcierto porcentaje={val} />,
    },
  ]
  return <Table columns={columns} data={datos} />
}

export default function Estadisticas() {
  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Refresco con estado propio, mismo criterio que Overview y HistorialUsuario:
  // `loading`/`error` son early returns que reemplazan la pantalla entera, y un
  // refresco fallido no puede llevarse puesto el reporte que se estaba leyendo.
  const [refrescando, setRefrescando] = useState(false)
  const [errorRefresco, setErrorRefresco] = useState(null)

  const [expandida, setExpandida] = useState(null)
  const [verTodo, setVerTodo] = useState(false)
  const [showNuncaServidas, setShowNuncaServidas] = useState(false)
  const [showSinFallos, setShowSinFallos] = useState(false)

  // La pregunta completa para el modal "Ver pregunta". El ranking sólo trae
  // texto y conteos, así que el contenido (opciones, imágenes, cuál es la
  // correcta) se pide aparte con GET /preguntas/:id.
  const [verPregunta, setVerPregunta] = useState(null)

  useEffect(() => {
    let active = true
    estadisticasApi
      .simaCheck()
      .then((data) => active && setDatos(data))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const refrescar = async () => {
    setRefrescando(true)
    setErrorRefresco(null)
    try {
      setDatos(await estadisticasApi.simaCheck())
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
      setDatos(await estadisticasApi.simaCheck())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const abrirPregunta = async (preguntaId) => {
    try {
      setVerPregunta(await preguntasApi.findOne(preguntaId))
    } catch (err) {
      setErrorRefresco(err.message)
    }
  }

  // Las tres vistas del ranking salen del MISMO array que devuelve el backend,
  // sin pedir nada más: ya viene ordenado por cantidad de errores.
  const conDatos = useMemo(
    () => (datos?.preguntas ?? []).filter((p) => p.respuestas > 0),
    [datos],
  )
  const nuncaServidas = useMemo(
    () => (datos?.preguntas ?? []).filter((p) => p.respuestas === 0 && p.enPoolActivo),
    [datos],
  )
  const sinFallos = useMemo(
    () =>
      conDatos.filter(
        (p) => p.incorrectas === 0 && p.respuestas >= MINIMO_SIGNIFICATIVO,
      ),
    [conDatos],
  )

  if (loading) {
    return <p className="text-slate-400 text-sm">Cargando estadísticas…</p>
  }
  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-red-600 text-sm">{error}</p>
        <Button variant="secondary" size="sm" onClick={reintentar}>
          Reintentar
        </Button>
      </div>
    )
  }

  const { totales, porBase, porCentroCosto, porPuesto } = datos
  const ranking = verTodo ? conDatos : conDatos.slice(0, RANKING_VISIBLE)

  return (
    <div className="space-y-7 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-slate-900 text-lg font-semibold">
            Estadísticas de contenido
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Qué preguntas se fallan, qué temas hay que reforzar y dónde.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refrescar} disabled={refrescando}>
          {refrescando ? 'Actualizando…' : '↻ Actualizar'}
        </Button>
      </div>

      {errorRefresco && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded px-4 py-2.5">
          No se pudo actualizar: {errorRefresco}. Lo que se ve abajo es la última
          lectura que sí llegó.
        </div>
      )}

      {/* Estado vacío UNA sola vez y arriba, en vez de repetir "sin datos" en
          los seis bloques de abajo. */}
      {totales.respuestas === 0 ? (
        <div className="bg-white border border-slate-200 rounded shadow-sm px-6 py-12 text-center">
          <p className="text-slate-500 text-sm">
            Todavía no hay evaluaciones rendidas.
          </p>
          <p className="text-slate-400 text-xs mt-1.5">
            Las estadísticas se calculan sobre las respuestas registradas desde la
            app de evaluación. Van a aparecer acá en cuanto alguien rinda.
          </p>
          {totales.preguntasEnPoolSinDatos > 0 && (
            <p className="text-slate-400 text-xs mt-4">
              Mientras tanto hay{' '}
              <span className="font-mono text-slate-600">
                {totales.preguntasEnPoolSinDatos}
              </span>{' '}
              preguntas publicadas esperando salir sorteadas.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard label="Evaluaciones rendidas" value={totales.sesiones} />
            <StatCard
              label="Acierto general"
              value={pctTexto(totales.porcentaje)}
              delta={`${totales.correctas} de ${totales.respuestas} respuestas`}
              deltaPositive={totales.porcentaje >= 70}
            />
            <StatCard
              label="Preguntas con datos"
              value={totales.preguntasConDatos}
              delta="Salieron sorteadas al menos una vez"
            />
            <StatCard
              label="Nunca servidas"
              value={totales.preguntasEnPoolSinDatos}
              delta="Publicadas, pero el sorteo nunca las eligió"
            />
          </div>

          <div>
            <SectionHeader ayuda="Ordenadas por cantidad de respuestas incorrectas. Una pregunta muy fallada puede ser un tema difícil o una pregunta mal redactada — abrila para ver en qué opción caen los errores.">
              Preguntas más falladas
            </SectionHeader>
            <div className="bg-white border border-slate-200 rounded shadow-sm divide-y divide-slate-200/70">
              {ranking.map((fila) => (
                <FilaRanking
                  key={fila.preguntaId}
                  fila={fila}
                  abierta={expandida === fila.preguntaId}
                  onToggle={() =>
                    setExpandida(expandida === fila.preguntaId ? null : fila.preguntaId)
                  }
                  onVer={() => abrirPregunta(fila.preguntaId)}
                />
              ))}
            </div>

            {conDatos.length > RANKING_VISIBLE && (
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setVerTodo((v) => !v)}
                >
                  {verTodo
                    ? `Ver sólo las ${RANKING_VISIBLE} primeras`
                    : `Ver las ${conDatos.length} preguntas`}
                </Button>
              </div>
            )}
          </div>

          <div>
            <SectionHeader ayuda="El acierto por tema es lo que dice qué hay que reforzar en la empresa. Dentro de cada base, los niveles van en el orden de su escala.">
              Acierto por base de conocimiento
            </SectionHeader>
            <div className="bg-white border border-slate-200 rounded shadow-sm divide-y divide-slate-200/70">
              {porBase.map((base) => (
                <div key={base.baseId ?? 'sin-clasificar'} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-medium flex-1 ${
                        base.baseId ? 'text-slate-900' : 'text-amber-600'
                      }`}
                    >
                      {base.baseNombre}
                    </span>
                    <span className="text-slate-400 text-xs font-mono">
                      {base.correctas}/{base.respuestas}
                    </span>
                    <div className="w-48">
                      <BarraAcierto porcentaje={base.porcentaje} />
                    </div>
                  </div>
                  {/* Los niveles sólo aportan si hay más de uno con datos. */}
                  {base.niveles.length > 1 && (
                    <div className="mt-2 pl-4 border-l-2 border-slate-100 space-y-1.5">
                      {base.niveles.map((nivel) => (
                        <div
                          key={nivel.nivelId ?? 'sin-nivel'}
                          className="flex items-center gap-3"
                        >
                          <span className="text-slate-500 text-xs flex-1">
                            {nivel.nivelNombre}
                          </span>
                          <span className="text-slate-400 text-[11px] font-mono">
                            {nivel.correctas}/{nivel.respuestas}
                          </span>
                          <div className="w-48">
                            <BarraAcierto porcentaje={nivel.porcentaje} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeader
              ayuda="Ojo con sumar estas columnas: una persona con más de un puesto o centro de costo cuenta en TODOS los suyos, así que las filas suman más que el total de respuestas. Es a propósito — esa persona trabaja en los dos lugares."
            >
              Dónde está el déficit
            </SectionHeader>
            <div className="grid lg:grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500 text-xs mb-1.5">Por centro de costo</p>
                <TablaCatalogo datos={porCentroCosto} etiqueta="Centro de costo" />
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1.5">Por puesto</p>
                <TablaCatalogo datos={porPuesto} etiqueta="Puesto" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {seccionPlegable(
              showNuncaServidas,
              () => setShowNuncaServidas((s) => !s),
              'Nunca servidas',
              nuncaServidas.length,
            )}
            {showNuncaServidas && (
              <>
                <p className="text-slate-400 text-xs">
                  Están publicadas en un módulo activo pero el sorteo todavía no
                  las eligió. Muchas acá significa que el pool es mucho más grande
                  que las preguntas que toma cada examen.
                </p>
                <ListaPreguntas
                  preguntas={nuncaServidas}
                  vacio="— Todas las preguntas publicadas ya salieron al menos una vez —"
                  onVer={abrirPregunta}
                />
              </>
            )}
          </div>

          <div className="space-y-2">
            {seccionPlegable(
              showSinFallos,
              () => setShowSinFallos((s) => !s),
              'Sin ningún fallo',
              sinFallos.length,
            )}
            {showSinFallos && (
              <>
                <p className="text-slate-400 text-xs">
                  Las acertó todo el mundo, con al menos {MINIMO_SIGNIFICATIVO}{' '}
                  respuestas. No discriminan a nadie: ocupan un lugar del examen
                  sin medir nada.
                </p>
                <ListaPreguntas
                  preguntas={sinFallos}
                  vacio="— Ninguna pregunta tiene acierto perfecto todavía —"
                  onVer={abrirPregunta}
                />
              </>
            )}
          </div>
        </>
      )}

      {verPregunta && (
        <VerPreguntaModal
          pregunta={verPregunta}
          onClose={() => setVerPregunta(null)}
        />
      )}
    </div>
  )
}
