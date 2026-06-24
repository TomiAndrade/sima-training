import { api } from './client'

export const organizacionesApi = {
  list: () => api.get('/organizaciones'),
}
