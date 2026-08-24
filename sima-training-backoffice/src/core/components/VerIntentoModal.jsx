import { useEffect, useState } from 'react'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { imagenUrl } from '../api/preguntas'
import { sesionesApi } from '../api/sesiones'
import { formatVersionNumero } from '../format/version'
import { backendTypeBadge } from '../format/tipoPregunta'
import { LETRAS_OPCION, marcaOpcion, opcionesDe } from '../format/opcionesPregunta'

// Modal "Ver intento": el detalle de UNA rendición, pregunta por pregunta.
//
// Existe porque la hoja de vida mostraba el score (9/15, desaprobado) pero no
// en qué se equivocó la persona — y eso es lo que hace falta para explicarle
// por qué desaprobó, y para detectar que la que falló era una pregunta mal
// armada y no ella.
//
// Vive en core/components/ y NO en sima-check/, aunque las preguntas sean del
// producto SIMA CHECK: lo abre HistorialUsuario.jsx, que está en core/pages/, y
// core/ nunca importa de sima-check/. Por eso los helpers de opciones (letras,
// V/F, el recuadro) se subieron a core/format/opcionesPregunta.js en vez de
// importarse de BancoPreguntas.jsx.
//
// Pide sus datos solo (`GET /sesiones/:id`, la única lectura con guard de toda
// la API) en vez de recibirlos por props: la lista de sesiones del informe trae
// el score de cada intento pero no sus respuestas, así que igual habría que
// pedirlas — y hacerlo acá evita cargar de a 20 detalles que nadie va a abrir.

const fechaHora = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

const chip = (cls) =>
  `px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${cls}`

// Una opción, con los tres estados posibles: la correcta, la que eligió la
// persona, o las dos a la vez.
function Opcion({ valor, letra, esImagen, esCorrecta, esElegida }) {
  const etiqueta = (
    <>
      {esCorrecta && (
        <span className="text-emerald-700 text-[11px] font-semibold uppercase tracking-wide flex-shrink-0">
          ✓ Correcta
        </span>
      )}
      {esElegida && (
        <span
          className={`text-[11px] font-semibold uppercase tracking-wide flex-shrink-0 ${
            esCorrecta ? 'text-emerald-700' : 'text-red-700'
          }`}
        >
          {esCorrecta ? '· Su respuesta' : '✗ Su respuesta'}
        </span>
      )}
    </>
  )

  if (esImagen) {
    return (
      <div className="space-y-1.5">
        <div className={`rounded border p-1 ${marcaOpcion(esCorrecta, esElegida)}`}>
          <img
            src={imagenUrl(valor)}
            alt={`Opción ${letra}`}
            className="w-full aspect-square object-contain"
          />
        </div>
        <p className="text-[11px] font-mono text-slate-400 flex flex-wrap gap-1">
          {letra}) {etiqueta}
        </p>
      </div>
    )
  }

  return (
    <div
      className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${marcaOpcion(esCorrecta, esElegida)}`}
    >
      <span className="text-slate-400 text-xs font-mono mt-0.5 w-4 flex-shrink-0">
        {letra})
      </span>
      <span
        className={`flex-1 ${
          esCorrecta
            ? 'text-emerald-800 font-medium'
            : esElegida
              ? 'text-red-800 font-medium'
              : 'text-slate-700'
        }`}
      >
        {valor}
      </span>
      <span className="flex items-center gap-1.5 mt-0.5">{etiqueta}</span>
    </div>
  )
}

function RespuestaCard({ respuesta, numero }) {
  const { pregunta } = respuesta
  const esImagen = pregunta.tipo === 'OPCIONES_IMAGEN'
  const opciones = opcionesDe(pregunta)
  const sinResponder = respuesta.respuestaDada == null

  // ⚠️ El ✓/✗ sale de `respuesta.correcta`, que es la corrección CONGELADA al
  // momento de rendir — NO de comparar `respuestaDada` con `respuestaCorrecta`,
  // que se lee viva del banco. Hoy coinciden siempre (no hay endpoint que edite
  // una pregunta), pero si algún día lo hay, el intento tiene que seguir
  // diciendo lo que se decidió entonces. No "simplificar" esto a una
  // comparación de strings.
  const acerto = respuesta.correcta

  return (
    <div className="border border-slate-200 rounded p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 text-xs font-mono">#{numero}</span>
          {backendTypeBadge(pregunta.tipo)}
          {pregunta.base && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-600 font-medium">
              {pregunta.base.nombre}
            </span>
          )}
          {pregunta.nivel && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500">
              {pregunta.nivel.nombre}
            </span>
          )}
          {/* La pregunta se muestra igual si después se mandó a papelera: una
              baja posterior no puede borrar lo que ya se rindió. Pero se avisa,
              porque explica por qué no aparece en el banco. */}
          {pregunta.activa === false && (
            <span className={chip('bg-amber-50 text-amber-600')}>En papelera</span>
          )}
        </div>
        <span
          className={chip(
            acerto ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
          )}
        >
          {acerto ? '✓ Bien' : '✗ Mal'}
        </span>
      </div>

      {pregunta.imagen && (
        <div className="rounded border border-slate-200 bg-slate-50 p-3 flex justify-center">
          <img
            src={imagenUrl(pregunta.imagen)}
            alt="Imagen del enunciado"
            className="max-h-48 object-contain"
          />
        </div>
      )}

      <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line">
        {pregunta.texto}
      </p>

      {sinResponder && (
        <p className="text-amber-600 text-xs">
          Sin responder — quedó en blanco.
        </p>
      )}

      {opciones.length === 0 ? (
        // TEXTO_LIBRE: no hay opciones que marcar, se muestra lo que escribió.
        <div className="text-sm">
          <span className="text-slate-500 text-xs">Respondió: </span>
          <span className="text-slate-800">{respuesta.respuestaDada ?? '—'}</span>
        </div>
      ) : esImagen ? (
        <div className="grid grid-cols-4 gap-3">
          {opciones.map((clave, i) => (
            <Opcion
              key={clave}
              valor={clave}
              letra={LETRAS_OPCION[i] ?? i + 1}
              esImagen
              // Comparación por CLAVE de storage cruda, igual que corregir.ts en
              // el backend: la URL armada daría siempre falso.
              esCorrecta={clave === pregunta.respuestaCorrecta}
              esElegida={clave === respuesta.respuestaDada}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {opciones.map((opcion, i) => (
            <Opcion
              key={`${opcion}-${i}`}
              valor={opcion}
              letra={LETRAS_OPCION[i] ?? i + 1}
              esCorrecta={opcion === pregunta.respuestaCorrecta}
              esElegida={opcion === respuesta.respuestaDada}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function VerIntentoModal({ sesionId, onClose }) {
  const [sesion, setSesion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    sesionesApi
      .detalle(sesionId)
      .then((data) => active && setSesion(data))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [sesionId])

  return (
    <Modal
      open
      onClose={onClose}
      title="Ver intento"
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {loading && <p className="text-slate-400 text-sm">Cargando el intento…</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {sesion && (
        <div className="space-y-5">
          <div className="border border-slate-200 rounded bg-slate-50 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-slate-900 font-medium text-sm">
                  {sesion.moduloVersion.modulo.nombre}
                </p>
                <p className="text-slate-500 text-xs">
                  Versión{' '}
                  <span className="font-mono">
                    {formatVersionNumero(sesion.moduloVersion)}
                  </span>
                  {' · '}
                  {/* createdAt (reloj del SERVIDOR) y no finalizadaEn (reloj del
                      dispositivo), mismo criterio que la tabla del historial. */}
                  <span className="font-mono">{fechaHora(sesion.createdAt)}</span>
                </p>
              </div>
              <span
                className={chip(
                  sesion.aprobada
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-600',
                )}
              >
                {sesion.aprobada ? 'Aprobado' : 'Desaprobado'}
              </span>
            </div>
            <p className="text-slate-600 text-xs">
              <span className="font-mono text-slate-800">
                {sesion.correctas}/{sesion.total}
              </span>{' '}
              correctas ·{' '}
              <span className="font-mono text-slate-800">{sesion.porcentaje}%</span>{' '}
              {/* El umbral que se aplicó, congelado en la fila: si mañana se
                  sube, este intento sigue diciendo con qué regla se evaluó. */}
              <span className="text-slate-400">
                (umbral de aprobación: {sesion.umbralAprobacion}%)
              </span>
            </p>
          </div>

          <div className="space-y-3">
            {sesion.respuestas.map((r, i) => (
              <RespuestaCard key={r.id} respuesta={r} numero={i + 1} />
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
