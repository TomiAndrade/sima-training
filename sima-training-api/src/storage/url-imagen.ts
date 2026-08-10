// Traduce una clave de imagen (Pregunta.imagen, u opciones de OPCIONES_IMAGEN)
// a la URL con la que se pide. Función PURA, mismo estilo que
// formato-imagen.ts — no toca Prisma ni Nest. Equivalente del imagenUrl() del
// backoffice (core/api/preguntas.js), pero relativa: acá no hay un BASE_URL
// para prefijar (ver el comentario de abajo).
//
// Conviven dos formatos (ver Pregunta.imagen en el schema):
// - clave opaca de storage ("preguntas/<uuid>.png"): se prefija con
//   UPLOADS_PREFIX. La URL queda RELATIVA a propósito — el backend no conoce
//   su propia URL pública (y menos la del deploy) y no vale la pena sumar una
//   env var sólo para esto; la tablet la resuelve contra la misma API base
//   que ya usa para todo lo demás.
// - ruta LEGACY del import de Excel (empieza con '/', ej. '/images/x.png'):
//   apunta al public/ del FRONTEND mockeado, no al storage del backend. Se
//   devuelve tal cual, sin prefijar.
import { UPLOADS_PREFIX } from './storage.service';

export function resolverUrlImagen(clave: string): string {
  if (clave.startsWith('/')) return clave;
  return `${UPLOADS_PREFIX}${clave}`;
}
