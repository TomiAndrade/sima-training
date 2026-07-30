import { api } from './client'

function buildQuery(params) {
  const qs = new URLSearchParams()
  if (params.puestoId) qs.set('puestoId', params.puestoId)
  if (params.centroCostoId) qs.set('centroCostoId', params.centroCostoId)
  if (params.moduloId) qs.set('moduloId', params.moduloId)
  if (params.activo !== undefined) qs.set('activo', String(params.activo))
  if (params.alcance) qs.set('alcance', params.alcance)
  const s = qs.toString()
  return s ? `?${s}` : ''
}

// Las tres mutaciones (create/update/remove) devuelven
// `{ regla, recalculo: { usuarios, creadas, revocadas } }`, no la regla pelada:
// tocar una regla recalcula en el acto las asignaciones AUTOMATICA de toda la
// gente con un par activo en ese centro de costo, y el resumen viaja en la
// respuesta para poder mostrar la consecuencia real.
export const reglasAsignacionApi = {
  list: (params = {}) => api.get(`/reglas-asignacion${buildQuery(params)}`),
  create: (data) => api.post('/reglas-asignacion', data),
  // Edición parcial: `{ moduloId?, activo? }`, al menos uno. El ALCANCE (puesto +
  // centro) no se edita — moverla de lugar es eliminarla y crear otra.
  // OJO: hoy el único caller es `setActivo`. `moduloId` está implementado en el
  // backend pero la pantalla de Reglas NO lo usa: cambiar el módulo en el lugar
  // conserva el id y el createdAt de la fila, así que la regla queda diciendo
  // que siempre obligó al módulo nuevo y —sin AuditLog todavía— el anterior no
  // queda registrado en ningún lado. La edición se resuelve por diff (alta de lo
  // agregado + baja de lo quitado), que deja los dos hechos.
  update: (id, data) => api.patch(`/reglas-asignacion/${id}`, data),
  // Baja/alta lógica: la pausa reversible. La regla sigue en el listado.
  setActivo: (id, activo) => reglasAsignacionApi.update(id, { activo }),
  // Eje distinto de `activo`: la regla sale del listado y no se puede recuperar
  // desde el backoffice. En la base es baja lógica (`deletedAt`, la fila es la
  // evidencia de por qué alguien tuvo que rendir un módulo), pero el GET filtra
  // las eliminadas y no hay filtro para verlas — de cara a esta pantalla, se fue.
  remove: (id) => api.del(`/reglas-asignacion/${id}`),
}
