import { api } from './client'

export const puestosApi = {
  list: () => api.get('/puestos'),
  create: (data) => api.post('/puestos', data),
  update: (id, data) => api.patch(`/puestos/${id}`, data),
}
