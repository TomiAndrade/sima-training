import { api } from './client'

export const modulosApi = {
  list: () => api.get('/modulos'),
  get: (id) => api.get(`/modulos/${id}`),
  // El backend espera el body como un array plano (no envuelto en un objeto).
  asignarPreguntas: (id, items) => api.post(`/modulos/${id}/preguntas`, items),
  // Baja lógica por módulo: activa/desactiva la asignación de la pregunta.
  setPreguntaActiva: (moduloId, preguntaId, activa) =>
    api.patch(`/modulos/${moduloId}/preguntas/${preguntaId}`, { activa }),
}
