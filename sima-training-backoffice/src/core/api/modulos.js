import { api } from './client'

export const modulosApi = {
  list: () => api.get('/modulos'),
  get: (id) => api.get(`/modulos/${id}`),
  create: (data) => api.post('/modulos', data),
  // Metadata del módulo (nombre/descripcion). El contenido se edita por versión.
  update: (id, data) => api.patch(`/modulos/${id}`, data),
  // El backend espera el body como un array plano (no envuelto en un objeto).
  asignarPreguntas: (id, items) => api.post(`/modulos/${id}/preguntas`, items),
  // Baja lógica por módulo: activa/desactiva la asignación de la pregunta.
  setPreguntaActiva: (moduloId, preguntaId, activa) =>
    api.patch(`/modulos/${moduloId}/preguntas/${preguntaId}`, { activa }),
  // Unassign duro: saca la pregunta del borrador (borra el pivot). Solo válido
  // mientras se edita un BORRADOR; sobre una versión publicada el backend rechaza.
  unassignPregunta: (moduloId, preguntaId) =>
    api.del(`/modulos/${moduloId}/preguntas/${preguntaId}`),
  // Set COMPLETO de criterios (base + nivel) de la versión en edición. PUT y no
  // PATCH porque el body reemplaza el set entero; el array vacío es válido y
  // significa "sacar todos los criterios". Materializa el pool en el acto y
  // devuelve { version, criterios, resolucion: { agregadas, quitadas,
  // conservadas, porCriterio } }. Solo vale sobre un BORRADOR (el backend
  // responde 409 si la versión ya está publicada).
  setCriterios: (id, criterios) => api.put(`/modulos/${id}/criterios`, { criterios }),
  // Cómo se rinde la versión en edición: preguntasPorExamen, umbralAprobacion,
  // maxIntentos y esperaEntreIntentosMinutos. PUT por el mismo motivo que los
  // criterios: reemplaza el set completo, y el campo que va en `null` vuelve al
  // default global del backend (3 preguntas / 70% / sin tope / sin espera). Solo
  // vale sobre un BORRADOR — 409 si la versión ya está publicada.
  setParametros: (id, data) => api.put(`/modulos/${id}/parametros`, data),
  // Crea un BORRADOR nuevo copiando las preguntas del ACTIVO, sin preguntar
  // actualización/versión nueva todavía — esa elección se hace recién al activar.
  crearVersion: (id) => api.post(`/modulos/${id}/versiones`, {}),
  // Publica el BORRADOR vigente: le asigna número y archiva el ACTIVO anterior.
  // esNuevaLinea (true=versión nueva, false=actualización) es obligatorio solo
  // si el módulo ya tenía un ACTIVO publicado del cual derivar el número.
  activar: (id, esNuevaLinea) => api.patch(`/modulos/${id}/activar`, { esNuevaLinea }),
  versiones: (id) => api.get(`/modulos/${id}/versiones`),
  versionDetalle: (id, versionId) => api.get(`/modulos/${id}/versiones/${versionId}`),
  // Descarta el borrador en curso. Si era la única versión (módulo nunca
  // publicado), el backend elimina el módulo entero junto con el borrador.
  cancelarBorrador: (id) => api.del(`/modulos/${id}/borrador`),
}
