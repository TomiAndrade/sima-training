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
  // [{ preguntaId, respuestaDada }], armado en finishEvaluation y mandado
  // en POST /tablet/sesiones junto con pendiente.asignacionId y
  // examen.moduloVersionId.
  const [respuestas, setRespuestas] = useState([])
  // Momento en que se terminó de responder (reloj del dispositivo, no
  // autoritativo — el backend igual lo usa para medir duración).
  const [finalizadaEn, setFinalizadaEn] = useState(null)
  // UUID por INTENTO, generado al cargar el examen (no al enviarlo). Un
  // reintento de EVALUACIÓN (retry()) pide el examen de nuevo y por lo
  // tanto genera uno nuevo; un reintento de ENVÍO (reintentarEnvio) manda
  // el mismo, para que el backend deduplique si el POST anterior sí llegó.
  const [claveIdempotencia, setClaveIdempotencia] = useState(null)
  const [iniciadaEn, setIniciadaEn] = useState(null)
  // Resultado real de la rendición ({ sesionId, correctas, total,
  // porcentaje, aprobada, umbralAprobacion }), lo que devuelve
  // POST /tablet/sesiones. No hay forma de calcularlo local: el backend
  // nunca manda respuestaCorrecta.
  const [result, setResult] = useState(null)
  const [cargandoExamen, setCargandoExamen] = useState(false)
  const [errorExamen, setErrorExamen] = useState('')
  const [enviandoResultado, setEnviandoResultado] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  const cargarExamen = async (item) => {
    setCargandoExamen(true)
    setErrorExamen('')
    try {
      const data = await tabletApi.examen(item.moduloId)
      setPendiente(item)
      setExamen(data)
      setClaveIdempotencia(crypto.randomUUID())
      setIniciadaEn(new Date())
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

  // POST /tablet/sesiones. Recibe respuestas/momentoFin explícitos en vez de
  // leerlos de `respuestas`/`finalizadaEn` (state) porque finishEvaluation los
  // necesita ANTES de que el setState correspondiente se refleje en este
  // closure; reintentarEnvio, en cambio, sí puede leerlos del state (ya están
  // asentados de la primera vez).
  const enviarResultado = async (respuestasPayload, momentoFin) => {
    setEnviandoResultado(true)
    setErrorEnvio('')
    try {
      const resultado = await tabletApi.registrarSesion({
        moduloVersionId: examen.moduloVersionId,
        asignacionId: pendiente.asignacionId,
        claveIdempotencia,
        iniciadaEn: iniciadaEn.toISOString(),
        finalizadaEn: momentoFin.toISOString(),
        respuestas: respuestasPayload,
      })
      setResult(resultado)
    } catch (err) {
      setErrorEnvio(
        err.status === undefined
          ? 'No hay conexión con el servidor. Reintentá cuando tengas señal.'
          : 'No pudimos registrar el resultado. Reintentá en un momento.',
      )
    } finally {
      setEnviandoResultado(false)
    }
  }

  const finishEvaluation = (answers) => {
    // answers = { [preguntaId]: respuestaDada }, ver Evaluation.jsx — no
    // depende del orden en que se hayan recorrido las preguntas.
    const respuestasPayload = examen.preguntas.map((q) => ({ preguntaId: q.id, respuestaDada: answers[q.id] ?? null }))
    const momentoFin = new Date()
    setRespuestas(respuestasPayload)
    setFinalizadaEn(momentoFin)
    setStep(STEPS.results)
    enviarResultado(respuestasPayload, momentoFin)
  }

  // Reintentar el ENVÍO (no la evaluación): misma claveIdempotencia, mismas
  // respuestas — si el POST anterior sí había llegado y solo se perdió la
  // respuesta, el backend dedupe y devuelve la sesión ya guardada en vez de
  // duplicarla.
  const reintentarEnvio = () => enviarResultado(respuestas, finalizadaEn)

  const retry = () => {
    setResult(null)
    setErrorEnvio('')
    // cargarExamen genera una claveIdempotencia NUEVA — es por intento, no
    // por módulo: reusar la anterior haría que el backend deduplique este
    // reintento contra la sesión vieja.
    cargarExamen(pendiente)
  }

  const goToModules = () => {
    setPendiente(null)
    setExamen(null)
    setRespuestas([])
    setFinalizadaEn(null)
    setClaveIdempotencia(null)
    setIniciadaEn(null)
    setResult(null)
    setErrorExamen('')
    setErrorEnvio('')
    setStep(STEPS.module)
  }

  const goHome = () => {
    setUsuario(null)
    setPendiente(null)
    setExamen(null)
    setRespuestas([])
    setFinalizadaEn(null)
    setClaveIdempotencia(null)
    setIniciadaEn(null)
    setResult(null)
    setErrorExamen('')
    setErrorEnvio('')
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
            enviando={enviandoResultado}
            errorEnvio={errorEnvio}
            onReintentarEnvio={reintentarEnvio}
            onRetry={retry}
            onGoToModules={goToModules}
            onHome={goHome}
          />
        )}
      </div>
    </div>
  )
}
