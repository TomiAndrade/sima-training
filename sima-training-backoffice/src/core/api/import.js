import { api } from './client'

export const importApi = {
  previewUsuarios: (file) => api.upload('/import/usuarios/preview', file),

  confirmarUsuarios: (file, organizacionId) => {
    const extra = organizacionId ? { organizacionId: String(organizacionId) } : {}
    return api.upload('/import/usuarios/confirm', file, 'file', extra)
  },

  // Import de preguntas: preview sube el Excel (multipart); confirm manda las
  // preguntas ya seleccionadas del preview como JSON (no re-sube el archivo).
  previewPreguntas: (file) => api.upload('/import/preguntas/preview', file),

  confirmarPreguntas: (preguntas, moduloId) =>
    api.post('/import/preguntas/confirm', { preguntas, moduloId: moduloId || undefined }),
}
