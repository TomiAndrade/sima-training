import Button from '../components/Button'

export default function Results({ usuario, module: mod, result, onRetry, onGoToModules, onHome }) {
  const { correct, total, percentage, approved } = result

  const feedbackMsg = approved
    ? '¡Muy bien! Demostraste conocimiento sólido en seguridad.'
    : 'Necesitás repasar los contenidos del módulo antes de continuar.'

  return (
    <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-8">
      {/* Score circle */}
      <div className={`w-40 h-40 rounded-full border-8 flex flex-col items-center justify-center mb-6 mx-auto ${approved ? 'border-emerald-500 bg-emerald-50' : 'border-red-600 bg-red-50'}`}>
        <span className={`text-5xl font-black ${approved ? 'text-emerald-600' : 'text-red-600'}`}>{percentage}%</span>
        <span className={`text-xs font-bold mt-1 ${approved ? 'text-emerald-600' : 'text-red-600'}`}>
          {correct} / {total} correctas
        </span>
      </div>

      {/* Badge */}
      <div className={`px-8 py-3 rounded-full text-xl font-black mb-4 text-center mx-auto w-fit ${approved ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white'}`}>
        {approved ? '✓ APROBADO' : '✗ DESAPROBADO'}
      </div>

      {/* Info */}
      <div className="text-center mb-8">
        <p className="text-slate-900 text-lg font-semibold mb-1">{usuario.name}</p>
        <p className="text-slate-500 text-sm">{mod.name}</p>
        <p className={`mt-3 text-sm max-w-xs mx-auto leading-relaxed ${approved ? 'text-emerald-700' : 'text-red-700'}`}>
          {feedbackMsg}
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button variant="primary" onClick={onGoToModules} fullWidth>
          Mis capacitaciones
        </Button>
        <Button variant="secondary" onClick={onRetry} fullWidth>
          Reintentar evaluación
        </Button>
        <Button variant="secondary" onClick={onHome} fullWidth>
          Volver al inicio
        </Button>
      </div>
    </div>
  )
}
