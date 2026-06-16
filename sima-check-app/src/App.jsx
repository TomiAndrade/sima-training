import { useState } from 'react'
import { pickRandomQuestions, calculateScore } from './utils/evaluation'
import EmployeeSelection from './pages/EmployeeSelection'
import ModuleSelection from './pages/ModuleSelection'
import Evaluation from './pages/Evaluation'
import Results from './pages/Results'

const STEPS = { employee: 'employee', module: 'module', evaluation: 'evaluation', results: 'results' }

export default function App() {
  const [step, setStep] = useState(STEPS.employee)
  const [employee, setEmployee] = useState(null)
  const [module, setModule] = useState(null)
  const [questions, setQuestions] = useState([])
  const [result, setResult] = useState(null)

  const startEvaluation = (mod) => {
    const picked = pickRandomQuestions(mod.questions, 3)
    setModule(mod)
    setQuestions(picked)
    setStep(STEPS.evaluation)
  }

  const finishEvaluation = (answers) => {
    const score = calculateScore(answers, questions)
    setResult(score)
    setStep(STEPS.results)
  }

  const retry = () => {
    const picked = pickRandomQuestions(module.questions, 3)
    setQuestions(picked)
    setResult(null)
    setStep(STEPS.evaluation)
  }

  const goHome = () => {
    setEmployee(null)
    setModule(null)
    setQuestions([])
    setResult(null)
    setStep(STEPS.employee)
  }

  if (step === STEPS.employee) {
    return (
      <EmployeeSelection
        onSelect={(emp) => { setEmployee(emp); setStep(STEPS.module) }}
      />
    )
  }

  if (step === STEPS.module) {
    return (
      <ModuleSelection
        employee={employee}
        onSelect={startEvaluation}
        onBack={() => setStep(STEPS.employee)}
      />
    )
  }

  if (step === STEPS.evaluation) {
    return (
      <Evaluation
        employee={employee}
        module={module}
        questions={questions}
        onFinish={finishEvaluation}
        onBack={() => setStep(STEPS.module)}
      />
    )
  }

  return (
    <Results
      employee={employee}
      module={module}
      result={result}
      onRetry={retry}
      onHome={goHome}
    />
  )
}
