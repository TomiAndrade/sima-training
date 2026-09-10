import { api } from './client'

export const authApi = {
  // "¿Quién soy?" — la identidad resuelta por el backend contra
  // Usuario+Vinculacion. El token de Auth0 NO trae el rol: el rol vive en la
  // Vinculacion de este backend, así que es la única forma que tiene el
  // frontend de saberlo.
  me: () => api.get('/auth/me'),
}
