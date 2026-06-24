import { api } from './client'

export const usuariosApi = {
  list: () => api.get('/usuarios'),
  create: (data) => api.post('/usuarios', data),
  update: (id, data) => api.patch(`/usuarios/${id}`, data),
  remove: (id) => api.del(`/usuarios/${id}`),
}
