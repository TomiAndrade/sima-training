import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario } from '@prisma/client';
import {
  AUTH0_EMAIL_CLAIM,
  Auth0VerifierService,
} from './auth0-verifier.service';
import { IS_PUBLIC_KEY } from './public.decorator';

// La identidad ya resuelta contra Usuario+Vinculacion — no el payload crudo
// del token. Es lo que un @Actor() (Story futura, no implementada acá) va a
// leer para el actor real del AuditLog.
export interface IdentidadResuelta {
  id: number;
  dni: string;
  nombre: string;
  apellido: string;
  email: string | null;
  rol: RolUsuario;
  organizacionId: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly auth0: Auth0VerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Token ausente');
    }

    const decodificado = this.jwt.decode(token, { complete: true }) as {
      header?: { alg?: string };
    } | null;
    const alg = decodificado?.header?.alg;

    if (alg === 'RS256') {
      await this.autenticarAuth0(token, request);
      return true;
    }
    throw new UnauthorizedException('Token inválido o expirado');
  }

  /**
   * Tokens RS256 de Auth0. Verifica contra JWKS y resuelve la identidad
   * local: primero por authProviderId, si no por email (linkeo de primer
   * login), nunca crea usuarios. Sólo ADMINISTRADOR/COORDINADOR/AUDITOR
   * pueden entrar por acá — los alumnos tienen su propia vía por la tablet.
   */
  private async autenticarAuth0(
    token: string,
    request: Request,
  ): Promise<void> {
    const payload = await this.auth0.verificar(token);

    let usuario = await this.prisma.usuario.findFirst({
      where: { authProviderId: payload.sub, deletedAt: null },
      include: { vinculacion: true },
    });

    if (!usuario) {
      const email = payload[AUTH0_EMAIL_CLAIM];
      if (typeof email !== 'string' || !email) {
        throw new ForbiddenException(
          'Tu cuenta no está habilitada en SIMA TRAINING',
        );
      }

      // findMany y no findFirst: email NO es único en el schema hoy. Con
      // findFirst, dos filas con el mismo email harían que el guard elija
      // una identidad a ciegas — acá se distinguen los tres casos reales.
      const candidatos = await this.prisma.usuario.findMany({
        where: { email, deletedAt: null },
        include: { vinculacion: true },
      });

      if (candidatos.length === 0) {
        throw new ForbiddenException(
          'Tu cuenta no está habilitada en SIMA TRAINING',
        );
      }
      if (candidatos.length > 1) {
        this.logger.error(
          `Login de Auth0 con email ambiguo "${email}": matchea ${candidatos.length} ` +
            `usuarios (ids ${candidatos.map((u) => u.id).join(', ')}). No se linkeó ninguno.`,
        );
        throw new ForbiddenException(
          'No se pudo resolver tu identidad. Contactá a un administrador.',
        );
      }

      usuario = await this.prisma.usuario.update({
        where: { id: candidatos[0].id },
        data: { authProviderId: payload.sub },
        include: { vinculacion: true },
      });
    }

    const vinculacion = usuario.vinculacion;
    if (!vinculacion || vinculacion.deletedAt || !vinculacion.activa) {
      throw new ForbiddenException('Tu cuenta no tiene una vinculación activa');
    }
    if (vinculacion.rol === RolUsuario.ALUMNO) {
      throw new ForbiddenException(
        'Los alumnos ingresan por la app SIMA CHECK, no por el backoffice',
      );
    }

    const identidad: IdentidadResuelta = {
      id: usuario.id,
      dni: usuario.dni,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      rol: vinculacion.rol,
      organizacionId: vinculacion.organizacionId,
    };
    (request as Request & { usuario?: IdentidadResuelta }).usuario = identidad;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
