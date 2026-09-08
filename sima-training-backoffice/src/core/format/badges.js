// Mapas de clases de badges compartidos entre pantallas. Son objetos planos de
// strings (no JSX) a propósito: cada pantalla decide el tamaño y la forma del
// <span>, acá sólo vive el color, que es lo que tiene que ser igual en todas.
//
// Viven en core/ porque los usan las dos capas (core/pages/Usuarios.jsx y
// core/pages/HistorialUsuario.jsx por un lado, sima-check/pages por el otro), y
// la regla de dependencia del proyecto es que core/ nunca importa de
// sima-check/.

// Rol de la Vinculacion. Los cuatro que admite el backend, aunque el alta del
// backoffice hoy sólo cree ALUMNO: un usuario legacy con otro rol se sigue
// mostrando con su color.
export const roleBadge = {
  ADMINISTRADOR: 'bg-red-50 text-red-600',
  COORDINADOR:   'bg-blue-50 text-blue-600',
  AUDITOR:       'bg-violet-50 text-violet-600',
  ALUMNO:        'bg-emerald-50 text-emerald-600',
}

// Origen de una Asignacion: la derivó el motor desde las reglas (AUTOMATICA) o
// la cargó un admin a mano (MANUAL).
export const origenBadge = {
  AUTOMATICA: 'bg-indigo-50 text-indigo-600',
  MANUAL:     'bg-slate-100 text-slate-600',
}

// Tipo de Organizacion. INTERNA no es un tipo que este ABM deje crear (sólo
// existe "Ingeniería SIMA"), pero el listado trae el catálogo completo y tiene
// que poder mostrarla igual.
export const tipoOrganizacionBadge = {
  CLIENTE:        'bg-blue-50 text-blue-600',
  SUBCONTRATISTA: 'bg-violet-50 text-violet-600',
  INTERNA:        'bg-slate-100 text-slate-600',
}
