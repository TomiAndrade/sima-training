import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { tabletApi } from './core/api/tablet'
import UsuarioSelection from './pages/UsuarioSelection'
import ModuleSelection from './pages/ModuleSelection'
import Evaluation from './pages/Evaluation'
import Results from './pages/Results'
import BannerActualizacion from './components/BannerActualizacion'

const STEPS = { usuario: 'usuario', module: 'module', evaluation: 'evaluation', results: 'results' }

export default function App() {
  const [step, setStep] = useState(STEPS.usuario)
  const [usuario, setUsuario] = useState(null)
  // El ítem elegido de GET /tablet/pendientes (asignacionId, moduloId,
  // nombre, descripcion, version) — se sigue pasando a Evaluation/Results
  // como prop `module`.
  const [pendiente, setPendiente] = useState(null)
  // Respuesta completa de GET /tablet/modulos/:moduloId/examen
  // ({ moduloId, moduloVersionId, modulo, version, preguntas }).
  const [examen, setExamen] = useState(null)
  // [{ preguntaId, respuestaDada }], armado en finishEvaluation — lo que el
  // commit 4 va a mandar en POST /tablet/sesiones junto con
  // pendiente.asignacionId y examen.moduloVersionId. Sin lectura propia
  // todavía en este componente (el commit 4 la agrega junto con el POST).
  const [, setRespuestas] = useState([])
  // Resultado real de la rendición. Queda en null hasta que el commit 4
  // conecte el POST y lo complete con lo que devuelve el backend — no hay
  // forma de calcularlo local sin respuestaCorrecta.
  const [result, setResult] = useState(null)
  const [cargandoExamen, setCargandoExamen] = useState(false)
  const [errorExamen, setErrorExamen] = useState('')

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  const cargarExamen = async (item) => {
    setCargandoExamen(true)
    setErrorExamen('')
    try {
      const data = await tabletApi.examen(item.moduloId)
      setPendiente(item)
      setExamen(data)
      setStep(STEPS.evaluation)
    } catch (err) {
      // El examen puede tirar 409 si el módulo se archivó (o se quedó sin
      // preguntas activas) entre que se cargó la lista y se tocó el botón.
      // No navega: se queda en la lista con el error a la vista.
      setErrorExamen(
        err.status === undefined
          ? 'No hay conexión con el servidor. Intentá de nuevo en un momento.'
          : 'Esta capacitación ya no está disponible para rendir. Probá con otra o volvé más tarde.',
      )
    } finally {
      setCargandoExamen(false)
    }
  }

  const startEvaluation = (item) => cargarExamen(item)

  const finishEvaluation = (answers) => {
    // answers = { [preguntaId]: respuestaDada }, ver Evaluation.jsx — no
    // depende del orden en que se hayan recorrido las preguntas.
    setRespuestas(examen.preguntas.map((q) => ({ preguntaId: q.id, respuestaDada: answers[q.id] ?? null })))
    setStep(STEPS.results)
  }

  const retry = () => {
    setResult(null)
    // TODO(commit 4): cuando exista claveIdempotencia, generar acá una NUEVA
    // — es por intento, no por módulo. Reusar la del intento anterior haría
    // que el backend deduplique este reintento contra la sesión vieja.
    cargarExamen(pendiente)
  }

  const goToModules = () => {
    setPendiente(null)
    setExamen(null)
    setRespuestas([])
    setResult(null)
    setErrorExamen('')
    setStep(STEPS.module)
  }

  const goHome = () => {
    setUsuario(null)
    setPendiente(null)
    setExamen(null)
    setRespuestas([])
    setResult(null)
    setErrorExamen('')
    setStep(STEPS.usuario)
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden"
      style={{ backgroundImage: "url('/SIMACHECK-FONDO.webp')", backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="relative z-10 w-full flex flex-col items-center justify-center gap-5">
        <img src="/SIMA_CHECK-logo.png" alt="SIMA CHECK" className="h-16 w-auto object-contain drop-shadow-md" />
        {needRefresh && (step === STEPS.usuario || step === STEPS.module) && (
          <BannerActualizacion onActualizar={() => updateServiceWorker(true)} />
        )}
        {step === STEPS.usuario && (
          <UsuarioSelection onSelect={(u) => { setUsuario(u); setStep(STEPS.module) }} />
        )}
        {step === STEPS.module && (
          <ModuleSelection
            usuario={usuario}
            onSelect={startEvaluation}
            onBack={() => setStep(STEPS.usuario)}
            cargandoExamen={cargandoExamen}
            errorExamen={errorExamen}
          />
        )}
        {step === STEPS.evaluation && (
          <Evaluation
            usuario={usuario}
            module={pendiente}
            questions={examen?.preguntas ?? []}
            onFinish={finishEvaluation}
            onBack={() => setStep(STEPS.module)}
          />
        )}
        {step === STEPS.results && (
          <Results
            usuario={usuario}
            module={pendiente}
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
