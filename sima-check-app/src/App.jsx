import { useState } from 'react'
import { pickRandomQuestions, calculateScore } from './utils/evaluation'
import { assignments as initialAssignments } from './data/assignments'
import UsuarioSelection from './pages/UsuarioSelection'
import ModuleSelection from './pages/ModuleSelection'
import Evaluation from './pages/Evaluation'
import Results from './pages/Results'

const STEPS = { usuario: 'usuario', module: 'module', evaluation: 'evaluation', results: 'results' }

export default function App() {
  const [step, setStep] = useState(STEPS.usuario)
  const [usuario, setUsuario] = useState(null)
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
          a.employeeId === usuario.id && a.moduleId === module.id && a.status === 'pending'
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
    setUsuario(null)
    setModule(null)
    setQuestions([])
    setResult(null)
    setStep(STEPS.usuario)
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden"
      style={{ backgroundImage: "url('/SIMACHECK-FONDO.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="relative z-10 w-full flex flex-col items-center justify-center gap-5">
        <img src="/logo.png" alt="SIMA CHECK" className="h-16 w-auto object-contain drop-shadow-md" />
        {step === STEPS.usuario && (
          <UsuarioSelection onSelect={(u) => { setUsuario(u); setStep(STEPS.module) }} />
        )}
        {step === STEPS.module && (
          <ModuleSelection
            usuario={usuario}
            assignments={assignments}
            onSelect={startEvaluation}
            onBack={() => setStep(STEPS.usuario)}
          />
        )}
        {step === STEPS.evaluation && (
          <Evaluation
            usuario={usuario}
            module={module}
            questions={questions}
            onFinish={finishEvaluation}
            onBack={() => setStep(STEPS.module)}
          />
        )}
        {step === STEPS.results && (
          <Results
            usuario={usuario}
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
