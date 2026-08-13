import Button from '../../components/Button'
import {
  DEFAULT_PREGUNTAS,
  DEFAULT_UMBRAL,
  equivalenteEnCorrectas,
} from './parametrosExamen'

// Cómo se rinde una versión de módulo: cuántas preguntas toma la tablet, con qué
// porcentaje se aprueba, cuántos reintentos hay y cuánto se espera entre uno y
// otro. Controlado, igual que CriteriosPanel: el padre tiene los valores y
// recibe los nuevos por onChange.
//
// Se usa en TRES lugares con la misma forma: el modal de "Nuevo módulo" (donde
// el guardado es parte del submit, así que va con mostrarGuardar={false}), la
// vista de contenido del borrador (donde tiene su propio botón, como los
// criterios) y el modal de "Ver detalles" (readOnly).
//
// La traducción entre el formato del formulario (strings) y el del backend
// (números o null) vive en ./parametrosExamen.

const inputCls =
  'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

// Cómo se lee un valor guardado en las vistas de solo lectura: el default
// explicitado en vez de un guión, porque "—" no distingue "no configurado" de
// "no se aplica".
//
// El campo ausente llega como string VACÍO y no como null: los valores siempre
// viajan por el formato del formulario (ver parametrosDesdeVersion), incluso en
// las vistas que nunca editan nada.
function textoValor(valor, textoDefault) {
  return String(valor ?? '').trim() === '' ? textoDefault : String(valor)
}

function Campo({ label, ayuda, valor, onChange, placeholder, min = 1, max }) {
  return (
    <div>
      <label className="block text-slate-700 text-sm font-medium mb-1">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        className={inputCls}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <p className="text-slate-400 text-[11px] mt-1">{ayuda}</p>
    </div>
  )
}

export default function ParametrosExamenPanel({
  valores,
  readOnly = false,
  onChange,
  onGuardar,
  guardando = false,
  error = null,
  dirty = false,
  mostrarGuardar = true,
  // Sin marco ni header: para embeberlo en un modal que ya tiene los suyos.
  desnudo = false,
}) {
  const equivalente = equivalenteEnCorrectas(
    valores.preguntasPorExamen,
    valores.umbralAprobacion,
  )

  const cambiar = (campo) => (valor) => onChange({ ...valores, [campo]: valor })

  const cuerpo = readOnly ? (
    <dl className={`grid grid-cols-2 gap-x-4 gap-y-3 text-sm ${desnudo ? '' : 'px-4 py-3'}`}>
      <div>
        <dt className="text-slate-400 text-xs font-medium mb-0.5">Preguntas por examen</dt>
        <dd className="text-slate-900 font-mono">
          {textoValor(valores.preguntasPorExamen, `${DEFAULT_PREGUNTAS} (por defecto)`)}
        </dd>
      </div>
      <div>
        <dt className="text-slate-400 text-xs font-medium mb-0.5">Se aprueba con</dt>
        <dd className="text-slate-900 font-mono">
          {textoValor(valores.umbralAprobacion, `${DEFAULT_UMBRAL} (por defecto)`)}%
        </dd>
      </div>
      <div>
        <dt className="text-slate-400 text-xs font-medium mb-0.5">Reintentos</dt>
        <dd className="text-slate-900 font-mono">
          {textoValor(valores.maxIntentos, 'sin límite')}
        </dd>
      </div>
      <div>
        <dt className="text-slate-400 text-xs font-medium mb-0.5">Espera entre intentos</dt>
        <dd className="text-slate-900 font-mono">
          {valores.esperaEntreIntentosMinutos
            ? `${valores.esperaEntreIntentosMinutos} min`
            : 'sin espera'}
        </dd>
      </div>
    </dl>
  ) : (
    <div className={desnudo ? 'space-y-4' : 'px-4 py-3 space-y-4'}>
      <div className="grid grid-cols-2 gap-4">
        <Campo
          label="Preguntas por examen"
          ayuda={`Cuántas sortea la app de cada evaluación. Vacío = ${DEFAULT_PREGUNTAS}.`}
          valor={valores.preguntasPorExamen}
          onChange={cambiar('preguntasPorExamen')}
          placeholder={String(DEFAULT_PREGUNTAS)}
        />
        <Campo
          label="Se aprueba con (%)"
          ayuda={`Porcentaje mínimo de respuestas correctas. Vacío = ${DEFAULT_UMBRAL}%.`}
          valor={valores.umbralAprobacion}
          onChange={cambiar('umbralAprobacion')}
          placeholder={String(DEFAULT_UMBRAL)}
          max={100}
        />
      </div>

      {equivalente && (
        <div className="bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded px-3 py-2">
          Con estos valores hay que responder bien{' '}
          <strong className="font-mono">{equivalente.correctas}</strong> de{' '}
          <strong className="font-mono">{equivalente.preguntas}</strong> para aprobar
          {' '}({equivalente.umbral}%).
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Campo
          label="Reintentos permitidos"
          ayuda="Cuántas veces puede rendirlo una persona. El contador se reinicia cuando aprueba. Vacío = sin límite."
          valor={valores.maxIntentos}
          onChange={cambiar('maxIntentos')}
          placeholder="sin límite"
        />
        <Campo
          label="Espera entre intentos (minutos)"
          ayuda="Cuánto tiene que pasar antes de poder reintentar. Vacío = puede reintentar en el acto."
          valor={valores.esperaEntreIntentosMinutos}
          onChange={cambiar('esperaEntreIntentosMinutos')}
          placeholder="sin espera"
        />
      </div>
    </div>
  )

  if (desnudo) return cuerpo

  return (
    <div className="border border-slate-200 rounded bg-white">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">
            Cómo se rinde este módulo
          </span>
          <p className="text-slate-400 text-[11px] mt-0.5">
            {readOnly
              ? 'Los parámetros con los que se publicó esta versión.'
              : 'Cuántas preguntas toma la app, con cuánto se aprueba y cómo se reintenta.'}
          </p>
        </div>
        {!readOnly && mostrarGuardar && (
          <Button size="sm" onClick={onGuardar} disabled={!dirty || guardando}>
            {guardando ? 'Guardando...' : 'Guardar parámetros'}
          </Button>
        )}
      </div>

      {error && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 text-red-700 text-xs">{error}</div>
      )}

      {cuerpo}
    </div>
  )
}
