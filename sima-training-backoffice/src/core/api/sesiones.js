import { api } from './client'

export const sesionesApi = {
  // El detalle de UN intento: qué se preguntó, qué contestó la persona, si
  // estuvo bien y cuál era la correcta.
  //
  // `getAuth` y no `get`: es el único GET protegido de la API. Devuelve la
  // respuesta correcta de cada pregunta, que es justamente lo que el backend
  // nunca le manda a la tablet — ver el comentario de sesiones.controller.ts.
  detalle: (id) => api.getAuth(`/sesiones/${id}`),
}
