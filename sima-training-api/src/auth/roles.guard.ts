import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RolUsuario } from '@prisma/client';
import { IdentidadResuelta } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';

/**
 * Segundo guard global, después de `JwtAuthGuard`. Aquél responde "¿quién
 * sos?", éste "¿podés hacer esto?".
 *
 * Es FAIL-CLOSED: una ruta sin `@Roles()` no la puede ejecutar NADIE, ni un
 * administrador. Eso es a propósito y es la razón por la que los 61
 * endpoints se decoraron en el mismo commit que activó el guard: el modo de
 * falla de un endpoint olvidado tiene que ser "se rompe a la vista de
 * todos", no "queda abierto en silencio". El test de exhaustividad
 * (`roles-cobertura.spec.ts`) hace que ese olvido falle en CI y no en
 * producción.
 *
 * ⚠️ Con UNA excepción, que es la única autorización del proyecto que no
 * vive en un decorador: `PATCH /usuarios/:id` deja tocar `vinculacion.rol`
 * y `vinculacion.organizacionId` dentro del body, y ningún decorador de
 * endpoint puede filtrar campos de un body. El chequeo está en
 * `UsuariosService.update()`. Si algún día aparece otro endpoint cuyo DTO
 * permita escalar privilegios, va a necesitar lo mismo — `@Roles()` solo no
 * alcanza para eso.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Las @Public() salen antes de mirar nada más. No es una optimización:
    // son las 10 rutas de /health, /uploads/* y los dos flujos de la tablet
    // (alumno e invitado), que se autentican con SU propio guard y su propio
    // token. Ahí no hay ningún `request.usuario` que mirar, así que sin este
    // early return el guard las denegaría a todas y se llevaría puesta la
    // app entera.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const roles = this.reflector.getAllAndOverride<RolUsuario[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context
      .switchToHttp()
      .getRequest<Request & { usuario?: IdentidadResuelta }>();

    if (!roles || roles.length === 0) {
      // Un endpoint sin decorar es un bug de programación, no un intento de
      // acceso indebido: se loguea con la ruta para poder arreglarlo, y al
      // cliente se le devuelve el 403 genérico de siempre.
      this.logger.error(
        `Ruta sin @Roles(): ${request.method} ${request.url} ` +
          `(${context.getClass().name}.${context.getHandler().name}). ` +
          `Fail-closed: denegada para todos los roles.`,
      );
      throw new ForbiddenException('No tenés permisos para esta operación');
    }

    // `request.usuario` lo setea JwtAuthGuard. Si esto viene vacío con la
    // ruta ya autenticada, el orden de los APP_GUARD está invertido.
    const rol = request.usuario?.rol;
    if (!rol || !roles.includes(rol)) {
      throw new ForbiddenException('No tenés permisos para esta operación');
    }

    return true;
  }
}
