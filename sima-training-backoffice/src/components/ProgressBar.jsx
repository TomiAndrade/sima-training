export default function ProgressBar({ value, max = 100, showLabel = true, color = 'amber' }) {
  const pct = Math.round((value / max) * 100)
  const colorMap = {
    amber: 'bg-red-600',
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
  }
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-slate-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${colorMap[color] || 'bg-red-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="text-slate-300 text-sm font-medium w-10 text-right">{pct}%</span>}
    </div>
  )
}
