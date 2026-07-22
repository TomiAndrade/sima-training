import { RolUsuario, TipoOrganizacion } from '@prisma/client';

// Matriz tipo-de-organización ↔ rol permitido (docs/modelo-vinculacion-propuesto.md §1).
//
// La regla cruza dos tablas — el rol vive en `Vinculacion`, el tipo en
// `Organizacion` —, así que no hay CHECK constraint posible sin un trigger:
// se valida a nivel service. Ésta es la ÚNICA copia de la matriz; tanto el alta
// manual (`UsuariosService.create/update`) como el import de Excel
// (`ImportService.confirmarUsuarios`, que delega en el mismo service) pasan
// por acá.
export const ROLES_POR_TIPO_ORGANIZACION: Record<
  TipoOrganizacion,
  RolUsuario[]
> = {
  // SIMA: todos los roles, incluidas las cuentas de sistema del backoffice.
  INTERNA: [
    RolUsuario.ADMINISTRADOR,
    RolUsuario.COORDINADOR,
    RolUsuario.AUDITOR,
    RolUsuario.ALUMNO,
  ],
  CLIENTE: [RolUsuario.AUDITOR],
  SUBCONTRATISTA: [RolUsuario.ALUMNO],
};

// Devuelve el motivo del rechazo, o `null` si la combinación es válida.
// No lanza a propósito: el alta manual lo convierte en un 400, y el import lo
// reporta como error de esa fila sin abortar el resto del archivo.
export function motivoRolNoPermitido(
  tipo: TipoOrganizacion,
  rol: RolUsuario,
): string | null {
  const permitidos = ROLES_POR_TIPO_ORGANIZACION[tipo];
  if (permitidos.includes(rol)) return null;
  return `El rol ${rol} no está permitido en una organización de tipo ${tipo} (permitidos: ${permitidos.join(', ')})`;
}
