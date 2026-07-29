import { api } from './client'

function buildQuery(params) {
  const qs = new URLSearchParams()
  if (params.activo !== undefined) qs.set('activo', String(params.activo))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export const centrosCostoApi = {
  // Sin params trae el catálogo completo (activos y dados de baja). Varios
  // consumidores lo necesitan así: ParesPuestoCentro para poder nombrar un
  // centro ya elegido que después se desactivó, ReglasAsignacion para agrupar
  // las reglas de centros dados de baja. Pasar { activo: true } solo donde se
  // ofrece elegir un centro nuevo.
  list: (params = {}) => api.get(`/centros-costo${buildQuery(params)}`),
  create: (data) => api.post('/centros-costo', data),
  update: (id, data) => api.patch(`/centros-costo/${id}`, data),
}
