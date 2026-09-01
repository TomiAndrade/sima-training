import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

// Payload del modo invitado. TERCER tipo de token del proyecto, después del de
// backoffice (`type: 'backoffice'`, Auth0 RS256) y el de alumno (`tipo:
// 'alumno'`, ver tablet-auth.guard.ts).
//
// La diferencia estructural con los otros dos: NO tiene `sub`. Un invitado no es
// ningún usuario de la base — no hay identidad que referenciar, sólo el nombre
// que escribió. Eso no es un detalle de implementación sino la garantía: un token
// de invitado no puede pedir las pendientes de nadie ni registrar una Sesion
// real, porque no hay id que poner en la query.
export interface InvitadoJwtPayload {
  tipo: 'invitado';
  // El nombre viaja FIRMADO en el token, no en el body de cada request. Mismo
  // principio que el `usuarioId` del alumno: quien rinde no puede decidir a
  // nombre de quién queda registrado el resultado. Se fija una vez al entrar y
  // ya no se puede cambiar sin pedir un token nuevo.
  nombre: string;
}

// Guard del modo invitado. Rechaza un token de alumno igual que TabletAuthGuard
// rechaza uno de invitado: cada tipo sirve para su mundo y ninguno cruza.
//
// Es un guard PROPIO y no un `TabletAuthGuard` flexibilizado a propósito. Si
// fuera el mismo con un chequeo opcional de `sub`, cada endpoint de alumno
// tendría que acordarse de verificar que el token no sea de invitado — y el
// olvido no falla ruidosamente, deja pasar a un invitado a una ruta real.
// Separados, un endpoint no puede aceptar el token equivocado por omisión.
@Injectable()
export class InvitadoAuthGuard implements CanActivate {
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

    if (!this.esPayloadDeInvitado(payload)) {
      throw new UnauthorizedException(
        'El token no corresponde a una sesión de invitado',
      );
    }

    (request as Request & { invitado?: InvitadoJwtPayload }).invitado = payload;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  private esPayloadDeInvitado(payload: unknown): payload is InvitadoJwtPayload {
    if (typeof payload !== 'object' || payload === null) return false;
    const p = payload as Record<string, unknown>;
    // Se exige que `nombre` sea un string NO VACÍO: el nombre termina en una
    // fila de sesiones_invitado, y un token firmado con nombre vacío dejaría
    // filas anónimas en el reporte — exactamente lo que el modo quiere evitar.
    return (
      p.tipo === 'invitado' &&
      typeof p.nombre === 'string' &&
      p.nombre.trim().length > 0
    );
  }
}

// El nombre SIEMPRE sale del token, nunca del body — mismo criterio que
// @UsuarioTablet() con el usuarioId.
export const NombreInvitado = createParamDecorator(
  (_: unknown, context: ExecutionContext): string => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { invitado?: InvitadoJwtPayload }>();
    return request.invitado!.nombre;
  },
);
