import { api } from './client'

function buildQuery(params) {
  const qs = new URLSearchParams()
  if (params.activa !== undefined) qs.set('activa', String(params.activa))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export const basesConocimientoApi = {
  // Sin params trae el catálogo completo (activas y dadas de baja), mismo
  // criterio que puestosApi: hace falta para poder nombrar una base ya elegida
  // que después se desactivó. Pasar { activa: true } sólo donde se ofrece
  // elegir una base nueva.
  // Cada base viene con sus `niveles` ordenados y con `_count.preguntas`
  // (por base y por nivel).
  list: (params = {}) => api.get(`/bases-conocimiento${buildQuery(params)}`),
  get: (id) => api.get(`/bases-conocimiento/${id}`),
  create: (data) => api.post('/bases-conocimiento', data),
  update: (id, data) => api.patch(`/bases-conocimiento/${id}`, data),

  crearNivel: (baseId, data) =>
    api.post(`/bases-conocimiento/${baseId}/niveles`, data),
  // Sólo renombra. Para mover un nivel de lugar va reordenarNiveles.
  actualizarNivel: (baseId, nivelId, data) =>
    api.patch(`/bases-conocimiento/${baseId}/niveles/${nivelId}`, data),
  eliminarNivel: (baseId, nivelId) =>
    api.del(`/bases-conocimiento/${baseId}/niveles/${nivelId}`),
  // Manda la escala COMPLETA en el orden deseado: el backend reindexa todo de
  // una porque el índice (base, orden) no tolera movimientos parciales.
  reordenarNiveles: (baseId, nivelIds) =>
    api.put(`/bases-conocimiento/${baseId}/niveles/orden`, { nivelIds }),
}
