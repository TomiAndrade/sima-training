import { RolUsuario } from '@prisma/client';
import { IdentidadResuelta } from '../auth/jwt-auth.guard';

// Las cuatro columnas de identidad real que agregó
// 20260910011054_audit_log_actor_identidad. Un solo tipo para no repetir los
// cuatro nombres de campo en cada controller que llama a
// AuditService.registrar().
export interface ActorIdentidad {
  actorUsuarioId: number;
  actorNombre: string;
  actorApellido: string;
  actorRol: RolUsuario;
}

// Traduce lo que ya resolvió JwtAuthGuard (lo que devuelve @Actor()) a esas
// cuatro columnas. Sólo tiene sentido para un actor autenticado del
// backoffice — un caller sin IdentidadResuelta (import, seeds, scripts) no
// llama a esto y deja esas cuatro columnas en null, con `actor` (el string
// de canal) como único rastro, igual que hoy.
export function actorDeIdentidad(identidad: IdentidadResuelta): ActorIdentidad {
  return {
    actorUsuarioId: identidad.id,
    actorNombre: identidad.nombre,
    actorApellido: identidad.apellido,
    actorRol: identidad.rol,
  };
}
