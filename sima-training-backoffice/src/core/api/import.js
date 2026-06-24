import { api } from './client'

export const importApi = {
  // Devuelve un preview del .xlsx SIN persistir (esqueleto Sprint 1).
  previewUsuarios: (file) => api.upload('/import/usuarios/preview', file),
}
