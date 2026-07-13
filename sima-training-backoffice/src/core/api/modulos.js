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
  // Crea un BORRADOR nuevo copiando las preguntas del ACTIVO. esNuevaLinea=true
  // sube MAYOR (versión nueva), false sube MENOR (actualización).
  crearVersion: (id, esNuevaLinea) =>
    api.post(`/modulos/${id}/versiones`, { esNuevaLinea }),
  // Publica el BORRADOR vigente: le asigna número y archiva el ACTIVO anterior.
  activar: (id) => api.patch(`/modulos/${id}/activar`, {}),
  versiones: (id) => api.get(`/modulos/${id}/versiones`),
  versionDetalle: (id, versionId) => api.get(`/modulos/${id}/versiones/${versionId}`),
  // Cambia si el borrador en curso se publica como actualización o versión
  // nueva, sin tocar sus preguntas (ej. al aceptar la recomendación de subir
  // a versión nueva por haber hecho muchos cambios).
  actualizarEleccionBorrador: (id, esNuevaLinea) =>
    api.patch(`/modulos/${id}/borrador`, { esNuevaLinea }),
}
