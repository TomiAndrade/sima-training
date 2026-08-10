export default function BannerActualizacion({ onActualizar }) {
  return (
    <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl px-5 py-4 mb-4 flex items-center justify-between gap-4">
      <p className="text-slate-700 text-sm font-medium">Hay una versión nueva disponible</p>
      <button
        onClick={onActualizar}
        className="shrink-0 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm py-2 px-4 rounded-xl transition-colors touch-manipulation"
      >
        Actualizar
      </button>
    </div>
  )
}
