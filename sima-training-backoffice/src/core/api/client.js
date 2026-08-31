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

// App.jsx registra acá un loginWithRedirect() (mismo patrón que el token
// getter de arriba). Se dispara cuando la sesión de Auth0 ya no se puede
// renovar sola: getAccessTokenSilently() tira (`login_required` — el
// refresh token venció) en vez de devolver un token nuevo, y eso pasaba sin
// que nadie lo atajara: la pantalla que disparó el request quedaba con una
// promesa rechazada y ningún camino de vuelta al login.
let onAuthError = null
export function setAuthErrorHandler(fn) {
  onAuthError = fn
}

async function obtenerToken() {
  if (!getAuth0Token) throw new Error('Auth0 todavía no está listo')
  try {
    return await getAuth0Token()
  } catch (err) {
    onAuthError?.()
    throw err
  }
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
    // Todavía 401 con un token que Auth0 dio por bueno: no es un token
    // vencido que un reintento arregla, es la sesión completa. Mismo
    // disparador que el catch de obtenerToken(), para el caso borde donde
    // getAccessTokenSilently() no tira pero el backend igual rechaza.
    if (res.status === 401) onAuthError?.()
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
    if (res.status === 401) onAuthError?.()
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
