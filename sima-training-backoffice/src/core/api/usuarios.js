import { api } from './client'

export const usuariosApi = {
  // limit alto: la pantalla todavía no tiene paginación en UI, así que traemos
  // todo en una sola página (la API sigue paginando internamente).
  list: () => api.get('/usuarios?limit=500').then((res) => res.data),
  create: (data) => api.post('/usuarios', data),
  update: (id, data) => api.patch(`/usuarios/${id}`, data),
  remove: (id) => api.del(`/usuarios/${id}`),
}
