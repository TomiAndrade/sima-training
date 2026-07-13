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

// Número público AÑO.MAYOR.MENOR (ej. "2026.01.00"). Un borrador todavía no
// publicado no tiene número (anio/mayor/menor en null).
export function formatVersionNumero(v) {
  if (!v || v.anio == null || v.mayor == null || v.menor == null) return 'Borrador'
  const pad = (n) => String(n).padStart(2, '0')
  return `${v.anio}.${pad(v.mayor)}.${pad(v.menor)}`
}

// Badge de ciclo de vida de una ModuloVersion: BORRADOR (ámbar) / ACTIVO
// (esmeralda) / ARCHIVADO (slate).
export function estadoVersionBadge(estado) {
  if (estado === 'ACTIVO') {
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600">Activo</span>
  }
  if (estado === 'ARCHIVADO') {
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">Archivado</span>
  }
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">Borrador</span>
}

// Hook: carga las preguntas ya asignadas a un módulo. Por default trae la
// versión vigente (ACTIVO si existe, si no la última) vía GET /modulos/:id.
// Si se pasa `versionId` (ej. el borrador en curso cuando coexiste con un
// ACTIVO publicado), trae esa versión puntual vía GET /modulos/:id/versiones/:versionId
// — necesario porque la "vigente" deja de ser el borrador en cuanto hay un ACTIVO.
// Devuelve la lista, el Set de ids asignados, el orden base (para numerar
// las nuevas), la función de refresco y el error de carga.
export function useBancoModulo(backendId, versionId) {
  const [version, setVersion] = useState(null)
  const [error, setError] = useState(null)

  const fetchVersion = () =>
    versionId ? modulosApi.versionDetalle(backendId, versionId) : modulosApi.get(backendId)

  const load = () => {
    if (!backendId) return Promise.resolve()
    return fetchVersion()
      .then((data) => {
        setVersion(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendId, versionId])

  const asignadas = version?.preguntas ?? []
  return {
    // Metadata de la versión cargada (estado/anio/mayor/menor/esNuevaLinea).
    version,
    asignadas,
    assignedIds: new Set(asignadas.map((mvp) => mvp.preguntaId)),
    baseOrden: asignadas.length,
    refresh: load,
    error,
  }
}
