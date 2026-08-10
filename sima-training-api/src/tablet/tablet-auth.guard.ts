import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

// Payload que firma TabletService.login(): distinto del backoffice (que usa
// `type: 'backoffice'`, ver auth.service.ts) tanto en la clave (`tipo`) como en
// el valor, para que un token de un lado no pueda confundirse con el otro por
// error de tipeo en el chequeo.
export interface TabletJwtPayload {
  sub: number;
  tipo: 'alumno';
}

// Guard propio de la tablet: un JWT de backoffice (auth/jwt-auth.guard.ts) NO
// pasa acá, y viceversa. Un atril en portería no puede tener credenciales de
// escritura del backoffice, así que los dos mundos usan tokens que no se
// aceptan entre sí aunque compartan el mismo secreto/JwtService.
@Injectable()
export class TabletAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Token ausente');
    }

    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    if (!this.esPayloadDeAlumno(payload)) {
      throw new UnauthorizedException(
        'El token no corresponde a una sesión de alumno',
      );
    }

    (request as Request & { user?: TabletJwtPayload }).user = payload;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  private esPayloadDeAlumno(payload: unknown): payload is TabletJwtPayload {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      (payload as Record<string, unknown>).tipo === 'alumno' &&
      typeof (payload as Record<string, unknown>).sub === 'number'
    );
  }
}

// El usuarioId SIEMPRE sale del token, nunca de un query param — un atril no
// puede pedir las pendientes de otra persona con sólo cambiar la URL.
export const UsuarioTablet = createParamDecorator(
  (_: unknown, context: ExecutionContext): number => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: TabletJwtPayload }>();
    return request.user!.sub;
  },
);
