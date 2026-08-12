import { api } from './client'

function buildQuery(params) {
  const qs = new URLSearchParams()
  // limit alto: la pantalla todavía no tiene paginación en UI, así que traemos
  // todo en una sola página (la API sigue paginando internamente).
  qs.set('limit', '500')
  // Los tres filtros de la lista de Usuarios. `puestoId` y `centroCostoId`
  // juntos NO son dos listas cruzadas: el backend los mete en el mismo
  // `puestosCentros: { some: { ... } }`, o sea que filtran por PAR EXACTO
  // (ver UsuariosService.findAll). Por eso se filtran acá y no en memoria: en
  // el cliente solo tenemos el par principal, que es display.
  if (params.organizacionId) qs.set('organizacionId', String(params.organizacionId))
  if (params.puestoId) qs.set('puestoId', params.puestoId)
  if (params.centroCostoId) qs.set('centroCostoId', params.centroCostoId)
  return `?${qs.toString()}`
}

export const usuariosApi = {
  list: (params = {}) => api.get(`/usuarios${buildQuery(params)}`).then((res) => res.data),
  // Hoja de vida de una persona en un solo request (Story 10): datos,
  // veredicto de habilitación, asignaciones con su vencimiento, rendiciones y
  // auditoría. Lectura abierta, como el resto de los GET.
  informe: (id) => api.get(`/usuarios/${id}/informe`),
  create: (data) => api.post('/usuarios', data),
  update: (id, data) => api.patch(`/usuarios/${id}`, data),
  remove: (id) => api.del(`/usuarios/${id}`),
}
