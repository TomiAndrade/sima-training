// Cliente HTTP del backoffice contra la API de SIMA Training.
// Base URL configurable por entorno (Vite). En dev apunta al backend local.
// Se exporta porque además de las llamadas hay que construir URLs de archivos
// servidos por la API (ver imagenUrl en preguntas.js).
export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Auth0 (Story 4): App.jsx llama a esto una vez que useAuth0() está listo,
// pasándole getAccessTokenSilently. Es la única vía de autenticación del
// backoffice — sin token getter registrado, cualquier request autenticado
// falla (no debería poder pasar: App.jsx no renderiza nada hasta que Auth0
// resuelve la sesión).
let getAuth0Token = null
export function setAuth0TokenGetter(fn) {
  getAuth0Token = fn
}

async function obtenerToken() {
  if (!getAuth0Token) throw new Error('Auth0 todavía no está listo')
  return getAuth0Token()
}

async function parse(res) {
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    const message = body?.message ?? `Error ${res.status}`
    throw new Error(Array.isArray(message) ? message.join(', ') : message)
  }
  return body
}

// Llamada genérica. `auth: true` adjunta el Bearer y reintenta una vez ante
// 401: getAccessTokenSilently() ya maneja su propio cacheo/refresh, así que
// el segundo intento le da la chance de traer un token renovado.
async function request(method, path, { body, auth = false } = {}) {
  const doFetch = async () => {
    const headers = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth) {
      headers['Authorization'] = `Bearer ${await obtenerToken()}`
    }
    return fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let res = await doFetch()
  if (auth && res.status === 401) {
    res = await doFetch()
  }
  return parse(res)
}

// Subida de archivos (multipart). No setea Content-Type: el browser agrega el
// boundary. Adjunta el Bearer y reintenta una vez ante 401.
async function upload(path, file) {
  const doFetch = async () => {
    const formData = new FormData()
    formData.append('file', file)
    return fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await obtenerToken()}` },
      body: formData,
    })
  }

  let res = await doFetch()
  if (res.status === 401) {
    res = await doFetch()
  }
  return parse(res)
}

export const api = {
  get: (path) => request('GET', path),
  // GET AUTENTICADO — la excepción a "los GET no llevan token".
  //
  // Existe por un solo consumidor: GET /sesiones/:id, el detalle de un intento,
  // que es la única lectura de toda la API que devuelve la respuesta correcta
  // de cada pregunta. El backend nunca se la manda a la tablet (es lo que
  // impide que un alumno que desaprobó las mire y reintente sabiéndolas), así
  // que ese endpoint va con guard y necesita el Bearer.
  //
  // Cualquier otro GET que se agregue debería usar `get` a secas.
  getAuth: (path) => request('GET', path, { auth: true }),
  post: (path, body) => request('POST', path, { body, auth: true }),
  // PUT se usa donde el body reemplaza un set completo (ej. el orden de los
  // niveles de una base), a diferencia de PATCH que actualiza campos sueltos.
  put: (path, body) => request('PUT', path, { body, auth: true }),
  patch: (path, body) => request('PATCH', path, { body, auth: true }),
  del: (path) => request('DELETE', path, { auth: true }),
  upload,
}
