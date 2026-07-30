import { api } from './client'

export const asignacionesApi = {
  // GET /asignaciones exige ?usuarioId= — no hay listado global de todas las
  // asignaciones del sistema (ver reglasAsignacion.js para el motor que las genera).
  list: (usuarioId) => api.get(`/asignaciones?usuarioId=${usuarioId}`),
  // Alta MANUAL. El origen AUTOMATICA no se crea desde acá, lo genera recalcular().
  create: (data) => api.post('/asignaciones', data),
  // Nunca se borra, se revoca (idempotente).
  revocar: (id) => api.patch(`/asignaciones/${id}/revocar`),
  // Fuerza el recálculo de las AUTOMATICA de una persona. Los dos caminos
  // normales ya lo disparan solos: el ABM de Usuarios al tocar los pares, y el
  // ABM de Reglas al crear/editar/eliminar una regla (recalcula todo el centro).
  // Queda como reconciliación manual para lo que ninguno de los dos cubre —
  // ojo que NO cubre dar de baja un Puesto o CentroCosto del catálogo: el motor
  // no mira `Puesto.activo`, así que ahí este endpoint tampoco cambia nada.
  recalcular: (usuarioId) => api.post(`/asignaciones/recalcular/${usuarioId}`, {}),
}
