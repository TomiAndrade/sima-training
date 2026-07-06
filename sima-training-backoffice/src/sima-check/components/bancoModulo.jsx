import { useEffect, useState } from 'react'
import { modulosApi } from '../../core/api/modulos'

// Helpers/hook del banco de preguntas de un módulo. Viven fuera de
// BancoPreguntas.jsx (que solo exporta componentes) para no romper la regla
// de fast-refresh `react-refresh/only-export-components`.

// Tipos de pregunta del backend (distintos de los del mock: truefalse/multiple/image-options).
export function backendTypeBadge(tipo) {
  if (tipo === 'VERDADERO_FALSO') return <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono border bg-sky-50 text-sky-600 border-sky-200">V / F</span>
  if (tipo === 'OPCIONES_IMAGEN') return <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono border bg-amber-50 text-amber-600 border-amber-200">Imágenes</span>
  if (tipo === 'TEXTO_LIBRE') return <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono border bg-slate-100 text-slate-500 border-slate-200">Texto libre</span>
  return <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono border bg-violet-50 text-violet-600 border-violet-200">Múltiple</span>
}

// Hook: carga las preguntas ya asignadas a la versión BORRADOR del módulo.
// Devuelve la lista, el Set de ids asignados, el orden base (para numerar
// las nuevas), la función de refresco y el error de carga.
export function useBancoModulo(backendId) {
  const [asignadas, setAsignadas] = useState([])
  const [error, setError] = useState(null)

  const refresh = () => {
    if (!backendId) return Promise.resolve()
    return modulosApi
      .get(backendId)
      .then((data) => {
        setAsignadas(data.preguntas ?? [])
        setError(null)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    if (!backendId) return
    modulosApi
      .get(backendId)
      .then((data) => {
        setAsignadas(data.preguntas ?? [])
        setError(null)
      })
      .catch((err) => setError(err.message))
  }, [backendId])

  return {
    asignadas,
    assignedIds: new Set(asignadas.map((mvp) => mvp.preguntaId)),
    baseOrden: asignadas.length,
    refresh,
    error,
  }
}
