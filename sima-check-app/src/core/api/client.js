// Cliente HTTP de la app tablet contra la API de SIMA Training.
// A diferencia del cliente del backoffice, acá no hay auto-login con
// credenciales fijas: el login es explícito por DNI, lo dispara la persona
// en UsuarioSelection. Este cliente sólo adjunta el token si ya existe.
export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const TOKEN_KEY = 'sima_check_token'

// sessionStorage y no localStorage: el atril es un dispositivo compartido y
// el token tiene que morir al cerrar la pestaña. Si el backend suma el modo
// "dispositivo" (ver docs/autenticacion-tablet.md) esto se reconsidera por modo.
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

async function parse(res) {
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    const message = body?.message ?? `Error ${res.status}`
    const error = new Error(Array.isArray(message) ? message.join(', ') : message)
    error.status = res.status
    throw error
  }
  return body
}

async function request(method, path, { body, auth = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    // fetch rechaza por red caída, no por status — se distingue de un error
    // HTTP porque este Error no lleva `status` (ver el catch en UsuarioSelection)
    throw new Error('No hay conexión con el servidor.')
  }

  return parse(res)
}

export const api = {
  get: (path) => request('GET', path, { auth: true }),
  post: (path, body, { auth = true } = {}) => request('POST', path, { body, auth }),
}
