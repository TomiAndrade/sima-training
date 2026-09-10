import { Controller, Get, UseGuards } from '@nestjs/common';
import { Actor } from './actor.decorator';
import { IdentidadResuelta, JwtAuthGuard } from './jwt-auth.guard';
import { LECTURA_BACKOFFICE } from './matriz-permisos';
import { Roles } from './roles.decorator';

/**
 * Controller nuevo, y el primero que tiene `auth/` desde que se eliminó
 * `POST /auth/login` en el cleanup post-Auth0: el login vive en Auth0, acá
 * no se emite ningún token de backoffice.
 */
@Controller('auth')
export class AuthController {
  /**
   * "¿Quién soy?". Devuelve la identidad ya resuelta contra
   * Usuario+Vinculacion — la misma que el guard usa para autorizar.
   *
   * Existe porque el backoffice no sabe su propio rol: Auth0 le da un token
   * y nada más, y el rol vive en la `Vinculacion` de este backend, no en el
   * token. Sin esto, el frontend no puede decidir qué mostrar (el caso
   * concreto es el select de rol admin-only de Usuarios).
   *
   * Va con LECTURA_BACKOFFICE, o sea los tres roles: leer la propia
   * identidad no es un privilegio, y el guard ya rechazó a los alumnos antes
   * de llegar acá. No expone nada que quien pregunta no sepa ya de sí mismo.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  me(@Actor() actor: IdentidadResuelta): IdentidadResuelta {
    return actor;
  }
}
