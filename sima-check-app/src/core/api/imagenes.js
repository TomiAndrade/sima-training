import { BASE_URL } from './client'

// Las url que manda el backend son relativas (/uploads/...) — se resuelven
// contra la misma API base que usa el resto de la app.
export function resolverImagenUrl(url) {
  if (!url) return null
  return `${BASE_URL}${url}`
}
