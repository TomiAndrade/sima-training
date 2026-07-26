import { api } from './client'

function buildQuery(params) {
  const qs = new URLSearchParams()
  if (params.puestoId) qs.set('puestoId', params.puestoId)
  if (params.centroCostoId) qs.set('centroCostoId', params.centroCostoId)
  if (params.moduloId) qs.set('moduloId', params.moduloId)
  if (params.activo !== undefined) qs.set('activo', String(params.activo))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export const reglasAsignacionApi = {
  list: (params = {}) => api.get(`/reglas-asignacion${buildQuery(params)}`),
  create: (data) => api.post('/reglas-asignacion', data),
  // Baja/alta lógica: el triple (puesto, centro, módulo) no se edita — para
  // cambiarlo hay que crear otra regla.
  setActivo: (id, activo) => api.patch(`/reglas-asignacion/${id}`, { activo }),
}
