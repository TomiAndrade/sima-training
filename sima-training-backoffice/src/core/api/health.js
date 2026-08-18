import { api } from './client'

export const healthApi = {
  // `{ status, service, db, timestamp }`. `db` es `'ok' | 'error'` y sale de un
  // `SELECT 1` real contra Postgres, no de que el proceso esté vivo.
  //
  // Siempre responde 200, incluso con la base caída — el detalle va en `db`,
  // no en el código HTTP (ver el comentario de HealthController: devolver 503
  // haría que Render reinicie el contenedor, y reiniciar no arregla una base
  // caída). O sea que acá **hay que mirar el body**, no sólo si el request
  // salió bien.
  check: () => api.get('/health'),
}
