import Button from '../components/Button'
import { motivoBloqueo } from '../core/reintentos'

export default function Results({ usuario, module: mod, result, enviando, errorEnvio, onReintentarEnvio, onRetry, onGoToModules, onHome }) {
  // El aprobado/desaprobado sale de `aprobada` (el backend congela el umbral
  // por sesión, ver Sesion.umbralAprobacion) — nunca se recalcula contra un
  // 70 hardcodeado del lado del cliente.
  const aprobada = result?.aprobada
  const bloqueoReintento = motivoBloqueo(result?.reintentos)

  const feedbackMsg = result
    ? aprobada
      ? '¡Muy bien! Demostraste conocimiento sólido en seguridad.'
      : 'Necesitás repasar los contenidos del módulo antes de continuar.'
    : null

  return (
    <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-8">
      {enviando && (
        <div className="w-40 h-40 rounded-full border-8 border-slate-300 bg-slate-50 flex flex-col items-center justify-center mb-6 mx-auto text-center px-4">
          <span className="text-slate-500 text-sm font-bold leading-snug">Enviando resultado...</span>
        </div>
      )}

      {!enviando && errorEnvio && (
        <div className="w-40 h-40 rounded-full border-8 border-red-300 bg-red-50 flex flex-col items-center justify-center mb-6 mx-auto text-center px-4">
          <span className="text-red-600 text-sm font-bold leading-snug">No se pudo enviar</span>
        </div>
      )}

      {!enviando && !errorEnvio && result && (
        <>
          {/* Score circle */}
          <div className={`w-40 h-40 rounded-full border-8 flex flex-col items-center justify-center mb-6 mx-auto ${aprobada ? 'border-emerald-500 bg-emerald-50' : 'border-red-600 bg-red-50'}`}>
            <span className={`text-5xl font-black ${aprobada ? 'text-emerald-600' : 'text-red-600'}`}>{result.porcentaje}%</span>
            <span className={`text-xs font-bold mt-1 ${aprobada ? 'text-emerald-600' : 'text-red-600'}`}>
              {result.correctas} / {result.total} correctas
            </span>
          </div>

          {/* Badge */}
          <div className={`px-8 py-3 rounded-full text-xl font-black mb-4 text-center mx-auto w-fit ${aprobada ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white'}`}>
            {aprobada ? '✓ APROBADO' : '✗ DESAPROBADO'}
          </div>
        </>
      )}

      {/* Info */}
      <div className="text-center mb-8">
        <p className="text-slate-900 text-lg font-semibold mb-1">{usuario.name}</p>
        <p className="text-slate-500 text-sm">{mod.nombre}</p>
        {!enviando && errorEnvio && (
          <p className="mt-3 text-sm max-w-xs mx-auto leading-relaxed text-red-700">{errorEnvio}</p>
        )}
        {feedbackMsg && (
          <p className={`mt-3 text-sm max-w-xs mx-auto leading-relaxed ${aprobada ? 'text-emerald-700' : 'text-red-700'}`}>
            {feedbackMsg}
          </p>
        )}
      </div>

      {/* Actions */}
      {!enviando && errorEnvio && (
        <div className="space-y-3">
          <Button variant="primary" onClick={onReintentarEnvio} fullWidth>
            Reintentar envío
          </Button>
        </div>
      )}

      {!enviando && !errorEnvio && result && (
        <div className="space-y-3">
          <Button variant="primary" onClick={onGoToModules} fullWidth>
            Mis capacitaciones
          </Button>
          {/* El estado de reintentos lo recalcula el backend DESPUÉS de
              registrar esta sesión. Si ya no se puede, se dice por qué en vez de
              ofrecer un botón que devuelve 409. */}
          {bloqueoReintento ? (
            <p className="text-slate-500 text-sm leading-relaxed text-center px-2">{bloqueoReintento}</p>
          ) : (
            <Button variant="secondary" onClick={onRetry} fullWidth>
              Reintentar evaluación
            </Button>
          )}
          <Button variant="secondary" onClick={onHome} fullWidth>
            Volver al inicio
          </Button>
        </div>
      )}
    </div>
  )
}
