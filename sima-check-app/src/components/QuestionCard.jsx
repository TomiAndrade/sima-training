const LETTERS = ['A', 'B', 'C', 'D']

function getTFStyle(opt, isSelected) {
  const isVerdadero = opt === 'Verdadero'
  if (isSelected) {
    return isVerdadero
      ? 'bg-emerald-600 border-emerald-600 text-white'
      : 'bg-red-600 border-red-600 text-white'
  }
  return isVerdadero
    ? 'bg-slate-800 border-emerald-700/60 text-slate-100 hover:border-emerald-500 hover:bg-emerald-900/20'
    : 'bg-slate-800 border-red-800/60 text-slate-100 hover:border-red-500 hover:bg-red-900/20'
}

export default function QuestionCard({ question, selectedAnswer, onSelect }) {
  const isTF = question.type === 'truefalse'
  const options = isTF ? ['Verdadero', 'Falso'] : question.options

  return (
    <div className="space-y-4">
      <p className="text-white text-2xl font-semibold leading-snug">{question.statement}</p>
      <div className={`grid gap-3 mt-6 ${isTF ? 'grid-cols-2' : 'grid-cols-1'}`}>
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
          return (
            <button
              key={i}
              onClick={() => onSelect(opt)}
              className={`w-full text-left px-5 py-4 rounded-2xl text-lg font-semibold border-2 transition-all duration-150 touch-manipulation select-none ${
                isSelected
                  ? 'bg-white border-white text-slate-900'
                  : 'bg-slate-800 border-slate-600 text-slate-100 hover:border-slate-400 hover:bg-slate-700'
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
