const LETTERS = ['A', 'B', 'C', 'D']

export default function QuestionCard({ question, selectedAnswer, onSelect }) {
  const isTF = question.type === 'truefalse'
  const options = isTF ? ['Verdadero', 'Falso'] : question.options

  return (
    <div className="space-y-4">
      <p className="text-white text-2xl font-semibold leading-snug">{question.statement}</p>
      <div className={`grid gap-3 mt-6 ${isTF ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {options.map((opt, i) => {
          const isSelected = selectedAnswer === opt
          return (
            <button
              key={i}
              onClick={() => onSelect(opt)}
              className={`w-full text-left px-5 py-4 rounded-2xl text-lg font-semibold border-2 transition-all duration-150 touch-manipulation select-none ${
                isSelected
                  ? 'bg-amber-500 border-amber-500 text-slate-950'
                  : 'bg-slate-800 border-slate-600 text-slate-100 hover:border-amber-500/50 hover:bg-slate-700'
              }`}
            >
              {!isTF && <span className="mr-3 opacity-60">{LETTERS[i]})</span>}
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
