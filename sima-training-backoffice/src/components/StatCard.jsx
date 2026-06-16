export default function StatCard({ label, value, icon, delta, deltaPositive }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded p-4 flex flex-col gap-2 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-zinc-700 via-zinc-600 to-transparent" />
      <span className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">{label}</span>
      <span className="text-3xl font-bold text-white font-mono leading-none">{value}</span>
      {delta && (
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${deltaPositive ? 'text-emerald-500' : 'text-amber-500'}`}>
          {delta}
        </span>
      )}
    </div>
  )
}
