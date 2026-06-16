import { useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import ProgressBar from '../components/ProgressBar'
import Button from '../components/Button'

export default function Evaluation({ employee, module: mod, questions, onFinish, onBack }) {
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
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 px-6 pt-6 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-slate-400 text-sm">{employee.name}</p>
            <p className="text-amber-500 font-semibold">{mod.name}</p>
          </div>
          <button onClick={onBack} className="text-slate-500 text-sm hover:text-slate-300 touch-manipulation">Cancelar</button>
        </div>
        <ProgressBar current={currentIndex + 1} total={questions.length} />
      </div>

      {/* Question */}
      <div className="flex-1 px-6 pt-8 pb-4">
        <QuestionCard
          question={current}
          selectedAnswer={currentAnswer}
          onSelect={handleSelect}
        />
      </div>

      {/* Footer */}
      <div className="px-6 pb-8 pt-4 flex gap-4">
        {currentIndex > 0 && (
          <Button variant="secondary" onClick={handlePrev} className="flex-shrink-0">
            ‹
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleNext}
          disabled={!currentAnswer}
          fullWidth
        >
          {isLast ? 'Ver resultado' : 'Siguiente pregunta'}
        </Button>
      </div>
    </div>
  )
}
