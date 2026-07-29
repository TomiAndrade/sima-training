// Badge compartido para el estado de clasificación por similitud (nueva/parecida/
// duplicada/error) que devuelve similitud.ts en el backend — usado tanto por el
// import de preguntas como por el de usuarios (puesto/centro de costo).
export default function EstadoSimilitudBadge({ estado, similar }) {
  const map = {
    nueva: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    parecida: 'bg-amber-50 text-amber-600 border-amber-200',
    duplicada: 'bg-red-50 text-red-600 border-red-200',
    error: 'bg-slate-100 text-slate-500 border-slate-200',
  }
  const label =
    estado === 'parecida' && similar
      ? `Parecida ${Math.round(similar.score * 100)}%`
      : estado === 'nueva'
        ? 'Nueva'
        : estado === 'duplicada'
          ? 'Duplicada'
          : 'Error'
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${map[estado]}`}>
      {label}
    </span>
  )
}
