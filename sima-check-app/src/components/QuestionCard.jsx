const LETTERS = ['A', 'B', 'C', 'D']

function getTFStyle(opt, isSelected) {
  const isVerdadero = opt === 'Verdadero'
  if (isSelected) {
    return isVerdadero
      ? 'bg-emerald-600 border-emerald-600 text-white'
      : 'bg-red-600 border-red-600 text-white'
  }
  return isVerdadero
    ? 'bg-white border-emerald-300 text-slate-800 hover:border-emerald-500 hover:bg-emerald-50'
    : 'bg-white border-red-300 text-slate-800 hover:border-red-500 hover:bg-red-50'
}

export default function QuestionCard({ question, selectedAnswer, onSelect }) {
  const isTF = question.type === 'truefalse'
  const isImageOpts = question.type === 'image-options'
  const options = isTF ? ['Verdadero', 'Falso'] : question.options

  return (
    <div className="space-y-4">
      <p className="text-slate-900 text-2xl font-semibold leading-snug">{question.statement}</p>
      {question.image && (
        <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
          <img src={question.image} alt="Imagen de referencia" className="w-full max-h-64 object-contain" />
        </div>
      )}
      <div className={`grid gap-3 mt-6 ${isTF || isImageOpts ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {options.map((opt, i) => {
          const isSelected = selectedAnswer === opt
          if (isTF) {
            return (
              <button
                key={i}
                onClick={() => onSelect(opt)}
                className={`w-full px-5 py-4 rounded-2xl text-lg font-semibold border-2 transition-all duration-150 touch-manipulation select-none text-center ${getTFStyle(opt, isSelected)}`}
              >
                {opt}
              </button>
            )
          }
          if (isImageOpts) {
            return (
              <button
                key={i}
                onClick={() => onSelect(opt)}
                className={`w-full aspect-square rounded-2xl overflow-hidden border-2 transition-all duration-150 touch-manipulation select-none ${
                  isSelected
                    ? 'border-red-600 ring-2 ring-red-600/30'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                <img src={opt} alt={`Opción ${LETTERS[i]}`} className="w-full h-full object-cover" />
              </button>
            )
          }
          return (
            <button
              key={i}
              onClick={() => onSelect(opt)}
              className={`w-full text-left px-5 py-4 rounded-2xl text-lg font-semibold border-2 transition-all duration-150 touch-manipulation select-none ${
                isSelected
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-300 text-slate-800 hover:border-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="mr-3 opacity-50">{LETTERS[i]})</span>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
