import { useState } from 'react'
import { pickRandomQuestions, calculateScore } from './utils/evaluation'
import { assignments as initialAssignments } from './data/assignments'
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
  const [assignments, setAssignments] = useState(initialAssignments)

  const startEvaluation = (mod) => {
    const picked = pickRandomQuestions(mod.questions, 3)
    setModule(mod)
    setQuestions(picked)
    setStep(STEPS.evaluation)
  }

  const finishEvaluation = (answers) => {
    const score = calculateScore(answers, questions)
    setResult(score)
    if (score.approved) {
      setAssignments((prev) =>
        prev.map((a) =>
          a.employeeId === employee.id && a.moduleId === module.id && a.status === 'pending'
            ? { ...a, status: 'completed' }
            : a
        )
      )
    }
    setStep(STEPS.results)
  }

  const retry = () => {
    const picked = pickRandomQuestions(module.questions, 3)
    setQuestions(picked)
    setResult(null)
    setStep(STEPS.evaluation)
  }

  const goToModules = () => {
    setModule(null)
    setQuestions([])
    setResult(null)
    setStep(STEPS.module)
  }

  const goHome = () => {
    setEmployee(null)
    setModule(null)
    setQuestions([])
    setResult(null)
    setStep(STEPS.employee)
  }

  return (
    // Para usar imagen de fondo: reemplazar el style con
    // backgroundImage: "url('/bg-industrial.jpg')", backgroundSize: 'cover', backgroundPosition: 'center'
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0c1118 0%, #1a2a3a 55%, #0c1118 100%)' }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 w-full flex items-center justify-center">
        {step === STEPS.employee && (
          <EmployeeSelection onSelect={(emp) => { setEmployee(emp); setStep(STEPS.module) }} />
        )}
        {step === STEPS.module && (
          <ModuleSelection
            employee={employee}
            assignments={assignments}
            onSelect={startEvaluation}
            onBack={() => setStep(STEPS.employee)}
          />
        )}
        {step === STEPS.evaluation && (
          <Evaluation
            employee={employee}
            module={module}
            questions={questions}
            onFinish={finishEvaluation}
            onBack={() => setStep(STEPS.module)}
          />
        )}
        {step === STEPS.results && (
          <Results
            employee={employee}
            module={module}
            result={result}
            onRetry={retry}
            onGoToModules={goToModules}
            onHome={goHome}
          />
        )}
      </div>
    </div>
  )
}
