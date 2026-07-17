import { api, BASE_URL } from './client'

// Formatos y peso que acepta el backend (ver src/storage/formato-imagen.ts).
// Se validan también acá para avisar sin round-trip; la autoridad es el backend.
export const IMAGEN_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const IMAGEN_MAX_BYTES = 2 * 1024 * 1024

// Traduce lo guardado en `Pregunta.imagen` a una URL mostrable.
// Dos formatos conviven: la clave opaca que devuelve POST /preguntas/imagen
// ("preguntas/<uuid>.png", se sirve bajo /uploads), y las rutas relativas a
// public/ que escribe el import de Excel ("/images/cartel.png"), que se usan
// tal cual.
export function imagenUrl(imagen) {
  if (!imagen) return null
  if (/^https?:\/\//.test(imagen) || imagen.startsWith('/')) return imagen
  return `${BASE_URL}/uploads/${imagen}`
}

function buildQuery(params) {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.etiqueta) qs.set('etiqueta', params.etiqueta)
  if (params.categoria) qs.set('categoria', params.categoria)
  if (params.activa !== undefined) qs.set('activa', String(params.activa))
  if (params.moduloId?.length) {
    params.moduloId.forEach((id) => qs.append('moduloId', id))
  }
  if (params.sinAsignar) qs.set('sinAsignar', 'true')
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export const preguntasApi = {
  list: (params = {}) => api.get(`/preguntas${buildQuery(params)}`),
  create: (data) => api.post('/preguntas', data),
  // Papelera global: activa=false envía a papelera (cascada backend a los
  // pivots por módulo); activa=true recupera (no restaura pivots).
  setActiva: (id, activa) => api.patch(`/preguntas/${id}`, { activa }),
  // Imagen del enunciado. Se sube antes de crear la pregunta y devuelve la
  // clave que va en el `imagen` del create. Una vez creada la pregunta la
  // imagen es inmutable: no hay endpoint para cambiarla.
  subirImagen: (file) => api.upload('/preguntas/imagen', file),
  // Solo sirve para limpiar una imagen recién subida cuya pregunta no llegó a
  // crearse: si ya está en uso, el backend responde 409.
  borrarImagen: (clave) =>
    api.del(`/preguntas/imagen/${encodeURIComponent(clave)}`),
}
