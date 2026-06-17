export default function ProgressBar({ questionNum, answered, total }) {
  const pct = Math.round((answered / total) * 100)
  return (
    <div className="w-full">
      <div className="flex justify-between text-slate-500 text-sm mb-2">
        <span>Pregunta {questionNum} de {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-3">
        <div
          className="h-3 rounded-full bg-red-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
