import { api } from './client'

// Log GLOBAL de auditoría (GET /audit-log), transversal a todas las
// entidades — distinto de `usuariosApi.informe()`, que trae el historial de
// UNA persona. Sólo ADMINISTRADOR y AUDITOR pueden pedirlo (ver AUDITORIA en
// matriz-permisos.ts del backend); acá no hay nada que replicar, el backend
// responde 403 si no corresponde.

// `desde`/`hasta` salen de un <input type="date"> (sin hora ni timezone).
// El DTO del backend (`@Type(() => Date)`) hace `new Date(string)` del lado
// del SERVIDOR — y una fecha-hora ISO sin offset ("...T23:59:59.999", sin
// "Z") el spec la interpreta como hora LOCAL de quien la parsea. Mandarla
// cruda sería ambigua: "local" pasaría a ser la timezone del proceso Node
// (Render, probablemente UTC), no la del navegador de quien eligió la fecha.
// Por eso el Date se arma ACÁ (en el navegador, con la timezone real de
// quien está mirando) y se manda ya resuelto a un instante UTC inequívoco
// con `.toISOString()` — nadie del lado del servidor tiene que adivinar de
// qué timezone es "medianoche". No es una timezone fija: es la del que usa
// la pantalla, sea cual sea.
const inicioDeDia = (fecha) => new Date(`${fecha}T00:00:00.000`).toISOString()
const finDeDia = (fecha) => new Date(`${fecha}T23:59:59.999`).toISOString()

function buildQuery(params) {
  const qs = new URLSearchParams()
  if (params.entidad) qs.set('entidad', params.entidad)
  if (params.actorRol) qs.set('actorRol', params.actorRol)
  if (params.actorUsuarioId) qs.set('actorUsuarioId', String(params.actorUsuarioId))
  if (params.desde) qs.set('desde', inicioDeDia(params.desde))
  if (params.hasta) qs.set('hasta', finDeDia(params.hasta))
  qs.set('page', String(params.page ?? 1))
  qs.set('limit', String(params.limit ?? 50))
  return `?${qs.toString()}`
}

export const auditoriaApi = {
  // { data, total, page, limit } — ids crudos, sin resolver nombres (ver
  // docs/decisiones/auditoria.md): la pantalla resuelve contra los catálogos
  // que ya tiene cargados para otras pantallas.
  listarGlobal: (params = {}) => api.get(`/audit-log${buildQuery(params)}`),
}
