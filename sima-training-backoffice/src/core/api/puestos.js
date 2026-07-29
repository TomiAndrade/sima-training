import { api } from './client'

function buildQuery(params) {
  const qs = new URLSearchParams()
  if (params.activo !== undefined) qs.set('activo', String(params.activo))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export const puestosApi = {
  // Sin params trae el catálogo completo (activos y dados de baja). Varios
  // consumidores lo necesitan así: ParesPuestoCentro para poder nombrar un
  // puesto ya elegido que después se desactivó, ReglasAsignacion para el mapa
  // id → nombre de las reglas viejas. Pasar { activo: true } solo donde se
  // ofrece elegir un puesto nuevo.
  list: (params = {}) => api.get(`/puestos${buildQuery(params)}`),
  create: (data) => api.post('/puestos', data),
  update: (id, data) => api.patch(`/puestos/${id}`, data),
}
