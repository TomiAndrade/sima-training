import { api } from './client'

function buildQuery(params) {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.etiqueta) qs.set('etiqueta', params.etiqueta)
  if (params.categoria) qs.set('categoria', params.categoria)
  if (params.activa !== undefined) qs.set('activa', String(params.activa))
  if (params.moduloId?.length) {
    params.moduloId.forEach((id) => qs.append('moduloId', id))
  }
  if (params.sinAsignar) qs.set('sinAsignar', 'true')
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export const preguntasApi = {
  list: (params = {}) => api.get(`/preguntas${buildQuery(params)}`),
  create: (data) => api.post('/preguntas', data),
  // Papelera global: activa=false envía a papelera (cascada backend a los
  // pivots por módulo); activa=true recupera (no restaura pivots).
  setActiva: (id, activa) => api.patch(`/preguntas/${id}`, { activa }),
}
