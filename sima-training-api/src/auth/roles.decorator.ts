import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';

/**
 * Declara qué roles pueden ejecutar una ruta. Lo lee `RolesGuard`.
 *
 * No se usa con roles sueltos: va con uno de los conjuntos de
 * `matriz-permisos.ts` (`@Roles(...LECTURA_BACKOFFICE)`), para que la
 * decisión de negocio viva en un solo archivo y no repartida por los
 * controllers.
 *
 * Su ausencia NO es "abierto": el guard es fail-closed y una ruta sin este
 * decorador la deniega para todos, administradores incluidos. Una ruta que
 * de verdad tiene que estar abierta lleva `@Public()`, que es otra cosa.
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
