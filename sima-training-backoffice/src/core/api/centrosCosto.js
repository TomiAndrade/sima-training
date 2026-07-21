import { api } from './client'

export const centrosCostoApi = {
  list: () => api.get('/centros-costo'),
  create: (data) => api.post('/centros-costo', data),
  update: (id, data) => api.patch(`/centros-costo/${id}`, data),
}
