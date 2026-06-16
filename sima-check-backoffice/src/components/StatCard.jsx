export default function StatCard({ label, value, icon, delta, deltaPositive }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm font-medium uppercase tracking-wide">{label}</span>
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-red-500 text-lg">
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold text-white">{value}</span>
        {delta && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${deltaPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {delta}
          </span>
        )}
      </div>
    </div>
  )
}
