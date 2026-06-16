import Button from '../components/Button'

export default function Results({ employee, module: mod, result, onRetry, onGoToModules, onHome }) {
  const { correct, total, percentage, approved } = result

  const feedbackMsg = approved
    ? '¡Muy bien! Demostraste conocimiento sólido en seguridad.'
    : 'Necesitás repasar los contenidos del módulo antes de continuar.'

  return (
    <div className="w-full max-w-sm bg-slate-900/90 backdrop-blur-sm border border-slate-700/60 rounded-2xl shadow-2xl p-8">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 justify-center">
        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center font-black text-white text-lg">S</div>
        <div>
          <div className="font-bold text-white text-base leading-tight">SIMA CHECK</div>
          <div className="text-slate-500 text-xs">Resultado</div>
        </div>
      </div>

      {/* Score circle */}
      <div className={`w-40 h-40 rounded-full border-8 flex flex-col items-center justify-center mb-6 mx-auto ${approved ? 'border-emerald-500 bg-emerald-500/10' : 'border-red-600 bg-red-600/10'}`}>
        <span className={`text-5xl font-black ${approved ? 'text-emerald-400' : 'text-red-400'}`}>{percentage}%</span>
        <span className={`text-xs font-bold mt-1 ${approved ? 'text-emerald-500' : 'text-red-500'}`}>
          {correct} / {total} correctas
        </span>
      </div>

      {/* Badge */}
      <div className={`px-8 py-3 rounded-full text-xl font-black mb-4 text-center mx-auto w-fit ${approved ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white'}`}>
        {approved ? '✓ APROBADO' : '✗ DESAPROBADO'}
      </div>

      {/* Info */}
      <div className="text-center mb-8">
        <p className="text-white text-lg font-semibold mb-1">{employee.name}</p>
        <p className="text-slate-400 text-sm">{mod.name}</p>
        <p className={`mt-3 text-sm max-w-xs mx-auto leading-relaxed ${approved ? 'text-emerald-300' : 'text-red-300'}`}>
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
