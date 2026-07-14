// Cliente HTTP del backoffice contra la API de SIMA Training.
// Base URL configurable por entorno (Vite). En dev apunta al backend local.
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Credenciales del backoffice (Sprint 1: login simple sin roles). El prototipo
// todavía no tiene pantalla de login, así que el cliente se autentica solo con
// las credenciales demo y cachea el token en memoria. Cuando exista la pantalla
// de login real (post Sprint 1), esto se reemplaza por el token de la sesión.
const AUTH_USER = import.meta.env.VITE_AUTH_USER ?? 'admin@sima.com'
const AUTH_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD ?? 'sima1234'

let token = null

async function parse(res) {
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) {
    const message = body?.message ?? `Error ${res.status}`
    throw new Error(Array.isArray(message) ? message.join(', ') : message)
  }
  return body
}

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: AUTH_USER, password: AUTH_PASSWORD }),
  })
  const body = await parse(res)
  token = body.access_token
  return token
}

// Llamada genérica. `auth: true` adjunta el Bearer (y reintenta el login una vez
// si el token expiró o falta).
async function request(method, path, { body, auth = false } = {}) {
  const doFetch = async () => {
    const headers = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth) {
      if (!token) await login()
      headers['Authorization'] = `Bearer ${token}`
    }
    return fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let res = await doFetch()
  if (auth && res.status === 401) {
    token = null
    await login()
    res = await doFetch()
  }
  return parse(res)
}

// Subida de archivos (multipart). No setea Content-Type: el browser agrega el
// boundary. Adjunta el Bearer y reintenta el login una vez ante 401.
async function upload(path, file, field = 'file', extraFields = {}) {
  const doFetch = async () => {
    if (!token) await login()
    const formData = new FormData()
    formData.append(field, file)
    for (const [key, val] of Object.entries(extraFields)) {
      formData.append(key, val)
    }
    return fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
  }

  let res = await doFetch()
  if (res.status === 401) {
    token = null
    await login()
    res = await doFetch()
  }
  return parse(res)
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, { body, auth: true }),
  patch: (path, body) => request('PATCH', path, { body, auth: true }),
  del: (path) => request('DELETE', path, { auth: true }),
  upload,
}
