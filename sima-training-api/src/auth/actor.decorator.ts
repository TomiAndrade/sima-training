import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { IdentidadResuelta } from './jwt-auth.guard';

/**
 * La identidad de quien está haciendo el request, ya resuelta contra
 * Usuario+Vinculacion por `JwtAuthGuard`. Mismo patrón que `@UsuarioTablet()`
 * en el otro flujo: el actor SIEMPRE sale del token, nunca del body ni de un
 * query param.
 *
 * Sólo tiene sentido en rutas autenticadas (todas menos las `@Public()`);
 * en una pública viene `undefined`.
 */
export const Actor = createParamDecorator(
  (_: unknown, context: ExecutionContext): IdentidadResuelta =>
    context
      .switchToHttp()
      .getRequest<Request & { usuario?: IdentidadResuelta }>().usuario!,
);
