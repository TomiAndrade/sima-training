import { api } from './client'

function buildQuery(params) {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.etiqueta) qs.set('etiqueta', params.etiqueta)
  if (params.categoria) qs.set('categoria', params.categoria)
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export const preguntasApi = {
  list: (params = {}) => api.get(`/preguntas${buildQuery(params)}`),
  create: (data) => api.post('/preguntas', data),
}
