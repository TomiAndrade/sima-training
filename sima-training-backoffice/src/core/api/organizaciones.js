import { api } from './client'

export const organizacionesApi = {
  list: () => api.get('/organizaciones'),
  create: (data) => api.post('/organizaciones', data),
  update: (id, data) => api.patch(`/organizaciones/${id}`, data),
}
