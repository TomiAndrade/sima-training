import {
  Injectable,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginTabletDto } from './dto/login-tablet.dto';

@Injectable()
export class TabletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly asignaciones: AsignacionesService,
  ) {}

  // Login PROVISIONAL de la app tablet: sólo DNI, sin PIN. El spike
  // (docs/autenticacion-tablet.md) recomienda DNI + PIN, pero las tres
  // preguntas abiertas para Eduardo (quién crea el PIN, cómo se resetea, y
  // qué exige ISO 9001 acá) siguen sin respuesta — este login es el interino
  // mientras tanto, apagable sin tocar código.
  //
  // TABLET_LOGIN_SIN_PIN por defecto en 'true'. Si se lo pone en 'false' antes
  // de que el flujo con PIN exista, el endpoint no puede cumplir lo que se le
  // pide: responde 501 en vez de fingir un login que no está implementado.
  async login(dto: LoginTabletDto) {
    if (this.config.get<string>('TABLET_LOGIN_SIN_PIN') === 'false') {
      throw new NotImplementedException(
        'El login con PIN todavía no está implementado (ver docs/autenticacion-tablet.md)',
      );
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: { dni: dto.dni, deletedAt: null },
      select: { id: true, nombre: true, apellido: true },
    });
    // 401 genérico a propósito: no hay que confirmarle a quien prueba DNIs al
    // voleo si uno existe o no.
    if (!usuario) {
      throw new UnauthorizedException('DNI o credenciales inválidas');
    }

    const payload = { sub: usuario.id, tipo: 'alumno' as const };
    const expiresIn = (this.config.get<string>('TABLET_JWT_EXPIRES_IN') ??
      '2h') as NonNullable<JwtSignOptions['expiresIn']>;

    return {
      access_token: this.jwt.sign(payload, { expiresIn }),
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
      },
    };
  }

  // Capacitaciones que le corresponde rendir a esta persona: sus asignaciones
  // vigentes, menos lo ya aprobado y lo que hoy no se puede rendir (módulo
  // dado de baja, o sin ninguna versión ACTIVO publicada). No es un filtro
  // sobre `origen`: da igual si la obligación es MANUAL o AUTOMATICA.
  async pendientes(usuarioId: number) {
    const [vigentes, aprobados] = await Promise.all([
      this.prisma.asignacion.findMany({
        where: { usuarioId, revocadaAt: null },
        select: {
          id: true,
          moduloId: true,
          modulo: {
            select: {
              nombre: true,
              descripcion: true,
              activo: true,
              // A lo sumo una versión ACTIVO por módulo (regla de negocio del
              // versionado): el filtro alcanza para "¿tiene algo publicado?".
              versiones: {
                where: { estado: 'ACTIVO' },
                select: { id: true, anio: true, mayor: true, menor: true },
              },
            },
          },
        },
      }),
      this.asignaciones.modulosAprobados(usuarioId),
    ]);

    return vigentes
      .filter((a) => !aprobados.has(a.moduloId))
      .filter((a) => a.modulo.activo)
      .filter((a) => a.modulo.versiones.length > 0)
      .map((a) => {
        const version = a.modulo.versiones[0];
        return {
          asignacionId: a.id,
          moduloId: a.moduloId,
          nombre: a.modulo.nombre,
          descripcion: a.modulo.descripcion,
          version: {
            id: version.id,
            anio: version.anio,
            mayor: version.mayor,
            menor: version.menor,
          },
        };
      });
  }
}
