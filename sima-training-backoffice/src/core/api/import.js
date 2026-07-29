import { api } from './client'

export const importApi = {
  previewUsuarios: (file) => api.upload('/import/usuarios/preview', file),

  // Igual que confirmarPreguntas: las filas ya vienen resueltas (puesto/centro
  // de costo matcheados o creados) desde el preview, no se re-sube el Excel.
  confirmarUsuarios: (organizacionId, usuarios) =>
    api.post('/import/usuarios/confirm', { organizacionId: Number(organizacionId), usuarios }),

  // Import de preguntas: preview sube el Excel (multipart); confirm manda las
  // preguntas ya seleccionadas del preview como JSON (no re-sube el archivo).
  previewPreguntas: (file) => api.upload('/import/preguntas/preview', file),

  confirmarPreguntas: (preguntas, moduloId) =>
    api.post('/import/preguntas/confirm', { preguntas, moduloId: moduloId || undefined }),
}
