import { api } from './client'

export const asignacionesApi = {
  // GET /asignaciones exige ?usuarioId= — no hay listado global de todas las
  // asignaciones del sistema (ver reglasAsignacion.js para el motor que las genera).
  list: (usuarioId) => api.get(`/asignaciones?usuarioId=${usuarioId}`),
  // Alta MANUAL. El origen AUTOMATICA no se crea desde acá, lo genera recalcular().
  create: (data) => api.post('/asignaciones', data),
  // Nunca se borra, se revoca (idempotente).
  revocar: (id) => api.patch(`/asignaciones/${id}/revocar`),
  // Fuerza el recálculo de las AUTOMATICA de una persona. El ABM de Usuarios ya
  // lo dispara solo al tocar los pares — este endpoint es para cuando cambiaron
  // las REGLAS, que no recalculan a nadie automáticamente.
  recalcular: (usuarioId) => api.post(`/asignaciones/recalcular/${usuarioId}`, {}),
}
