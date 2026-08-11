// Única fuente de verdad del formato de entidadId para VinculacionPuestoCentro
// — esa tabla no tiene id escalar propio (su PK es compuesta
// [vinculacionId, puestoId, centroCostoId]). Lo escribe
// UsuariosService.auditarPares() al registrar el log y lo lee
// AuditService.listarPorUsuario() al buscarlo — tienen que coincidir
// siempre, así que ninguno de los dos lo arma inline.
export function entidadIdPar(
  vinculacionId: number,
  puestoId: string,
  centroCostoId: string,
): string {
  return `${vinculacionId}:${puestoId}:${centroCostoId}`;
}

// Prefijo común a TODOS los pares de una vinculación — lo que permite
// encontrarlos en AuditLog sin depender de que la fila siga existiendo en
// VinculacionPuestoCentro (se borra FÍSICO al reemplazar el set de pares,
// así que un par sacado ya no tiene fila que leer, pero su historial en el
// log sigue empezando con este mismo prefijo).
export function entidadIdParPrefix(vinculacionId: number): string {
  return `${vinculacionId}:`;
}
