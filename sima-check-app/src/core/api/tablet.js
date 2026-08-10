import { api } from './client'

export const tabletApi = {
  login: (dni) => api.post('/tablet/login', { dni }, { auth: false }),
  pendientes: () => api.get('/tablet/pendientes'),
  examen: (moduloId) => api.get(`/tablet/modulos/${moduloId}/examen`),
  registrarSesion: (payload) => api.post('/tablet/sesiones', payload),
}
