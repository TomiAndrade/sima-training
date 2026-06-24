export default function StatCard({ label, value, delta, deltaPositive }) {
  return (
    <div className="bg-white border border-slate-200 rounded p-4 flex flex-col gap-2 relative overflow-hidden shadow-sm">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-600/40 via-slate-300 to-transparent" />
      <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">{label}</span>
      <span className="text-3xl font-bold text-slate-900 font-mono leading-none">{value}</span>
      {delta && (
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${deltaPositive ? 'text-emerald-600' : 'text-amber-600'}`}>
          {delta}
        </span>
      )}
    </div>
  )
}
