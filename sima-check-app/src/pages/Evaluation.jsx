import { useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import ProgressBar from '../components/ProgressBar'
import Button from '../components/Button'

export default function Evaluation({ usuario, module: mod, questions, onFinish, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState(Array(questions.length).fill(null))

  const current = questions[currentIndex]
  const currentAnswer = answers[currentIndex]
  const isLast = currentIndex === questions.length - 1

  const handleSelect = (answer) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[currentIndex] = answer
      return next
    })
  }

  const handleNext = () => {
    if (isLast) {
      onFinish(answers)
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1)
  }

  return (
    <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-slate-500 text-sm">{usuario.name}</p>
            <p className="text-red-600 font-semibold text-sm">{mod.name}</p>
          </div>
          <button onClick={onBack} className="text-slate-400 text-sm hover:text-slate-700 touch-manipulation">
            Cancelar
          </button>
        </div>
        {/* answered=currentIndex: la barra avanza al pasar a la siguiente pregunta */}
        <ProgressBar questionNum={currentIndex + 1} answered={currentIndex} total={questions.length} />
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4">
        <QuestionCard
          question={current}
          selectedAnswer={currentAnswer}
          onSelect={handleSelect}
        />
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 pt-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
        {currentIndex > 0 && (
          <Button variant="secondary" onClick={handlePrev} className="flex-shrink-0">
            ‹
          </Button>
        )}
        <Button variant="primary" onClick={handleNext} disabled={!currentAnswer} fullWidth>
          {isLast ? 'Ver resultado' : 'Siguiente pregunta'}
        </Button>
      </div>
    </div>
  )
}
