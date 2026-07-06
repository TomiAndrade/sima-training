import { api } from './client'

export const etiquetasApi = {
  list: () => api.get('/etiquetas'),
}
