import { api } from './client'

export const usuariosApi = {
  // limit alto: la pantalla todavía no tiene paginación en UI, así que traemos
  // todo en una sola página (la API sigue paginando internamente).
  list: () => api.get('/usuarios?limit=500').then((res) => res.data),
  // Hoja de vida de una persona en un solo request (Story 10): datos,
  // veredicto de habilitación, asignaciones con su vencimiento, rendiciones y
  // auditoría. Lectura abierta, como el resto de los GET.
  informe: (id) => api.get(`/usuarios/${id}/informe`),
  create: (data) => api.post('/usuarios', data),
  update: (id, data) => api.patch(`/usuarios/${id}`, data),
  remove: (id) => api.del(`/usuarios/${id}`),
}
