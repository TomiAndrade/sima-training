export default function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="w-full">
      <div className="flex justify-between text-slate-400 text-sm mb-2">
        <span>Pregunta {current} de {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-3">
        <div
          className="h-3 rounded-full bg-red-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
