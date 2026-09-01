import {
  ConflictException,
  Injectable,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { SesionesService } from '../sesiones/sesiones.service';
import { serializarPregunta } from './serializar-pregunta';
import { LoginTabletDto } from './dto/login-tablet.dto';
import { RegistrarSesionTabletDto } from './dto/registrar-sesion-tablet.dto';
import {
  evaluarReintentos,
  mensajeReintentos,
  SesionRendida,
} from './reintentos';
import { sortear } from './sorteo';

// Cuántas preguntas sortea un examen cuando la versión no declara nada. Dejó de
// ser LA cantidad y pasó a ser el FALLBACK: quien crea el módulo elige la suya en
// ModuloVersion.preguntasPorExamen, y este 3 sólo cubre las versiones publicadas
// antes de que esa columna existiera (nullable y sin backfill a propósito, ver la
// migración modulo_version_parametros_examen).
//
// Mismo rol que UMBRAL_APROBACION_DEFAULT en sesiones/corregir.ts, y por eso vive
// exportado y no inline: los tests lo usan para afirmar el caso "versión sin
// parámetros propios".
export const PREGUNTAS_POR_EXAMEN = 3;

@Injectable()
export class TabletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly asignaciones: AsignacionesService,
    private readonly sesiones: SesionesService,
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
                select: {
                  id: true,
                  anio: true,
                  mayor: true,
                  menor: true,
                  maxIntentos: true,
                  esperaEntreIntentosMinutos: true,
                },
              },
            },
          },
        },
      }),
      this.asignaciones.modulosAprobados(usuarioId),
    ]);

    const rendibles = vigentes
      .filter((a) => !aprobados.has(a.moduloId))
      .filter((a) => a.modulo.activo)
      .filter((a) => a.modulo.versiones.length > 0);

    // Una sola query para toda la tanda, no una por ítem. Va después del
    // Promise.all y no adentro porque depende de qué módulos sobrevivieron a
    // los filtros de arriba.
    const sesiones = await this.sesionesPorModulo(
      usuarioId,
      rendibles.map((a) => a.moduloId),
    );
    const ahora = new Date();

    return rendibles.map((a) => {
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
        // El pendiente viaja con su estado de reintentos para que la app pinte
        // el botón deshabilitado con el motivo, en vez de dejar tocar y comerse
        // un 409 recién ahí.
        reintentos: evaluarReintentos({
          sesiones: sesiones.get(a.moduloId) ?? [],
          maxIntentos: version.maxIntentos,
          esperaMinutos: version.esperaEntreIntentosMinutos,
          ahora,
        }),
      };
    });
  }

  // Las sesiones que cuentan para el tope de reintentos, agrupadas por módulo.
  // Se consulta por MÓDULO y no por versión (`moduloVersion: { moduloId }`):
  // publicar una versión nueva no le devuelve intentos a nadie — ver
  // reintentos.ts.
  private async sesionesPorModulo(usuarioId: number, moduloIds: string[]) {
    const porModulo = new Map<string, SesionRendida[]>();
    if (moduloIds.length === 0) return porModulo;

    const filas = await this.prisma.sesion.findMany({
      where: { usuarioId, moduloVersion: { moduloId: { in: moduloIds } } },
      select: {
        finalizadaEn: true,
        aprobada: true,
        moduloVersion: { select: { moduloId: true } },
      },
    });

    for (const fila of filas) {
      const moduloId = fila.moduloVersion.moduloId;
      const acumuladas = porModulo.get(moduloId) ?? [];
      acumuladas.push({
        finalizadaEn: fila.finalizadaEn,
        aprobada: fila.aprobada,
      });
      porModulo.set(moduloId, acumuladas);
    }
    return porModulo;
  }

  // El examen de un módulo: sortea las preguntas que pide la versión ACTIVO y
  // las serializa sin `respuestaCorrecta` — ver serializarPregunta().
  //
  // Recibe el usuarioId porque acá se aplica el tope de reintentos y la espera
  // entre intentos: el CONTENIDO del examen sigue siendo el mismo para
  // cualquiera que rinda esa versión, pero el derecho a pedirlo es personal.
  async examen(usuarioId: number, moduloId: string) {
    const modulo = await this.prisma.modulo.findUnique({
      where: { id: moduloId },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        activo: true,
        // A lo sumo una versión ACTIVO por módulo (regla de negocio del
        // versionado, mismo criterio que pendientes()).
        versiones: {
          where: { estado: 'ACTIVO' },
          select: {
            id: true,
            anio: true,
            mayor: true,
            menor: true,
            preguntasPorExamen: true,
            maxIntentos: true,
            esperaEntreIntentosMinutos: true,
          },
        },
      },
    });
    if (!modulo || !modulo.activo) {
      throw new NotFoundException(`El módulo ${moduloId} no existe`);
    }

    const version = modulo.versiones[0];
    if (!version) {
      // Cubre tanto "nunca se publicó" (sólo BORRADOR) como "se archivó entre
      // que la persona cargó la lista de pendientes y tocó el botón".
      throw new ConflictException(
        `El módulo ${moduloId} no tiene ninguna versión publicada para rendir`,
      );
    }

    // Tope de intentos y espera. Es el ÚNICO punto donde se aplican: registrar
    // una rendición ya hecha no se rechaza nunca (ver rendir() y
    // docs/pendientes.md). Va antes de armar el pool para no gastar la query de
    // pivots en alguien que no puede rendir.
    const reintentos = evaluarReintentos({
      sesiones:
        (await this.sesionesPorModulo(usuarioId, [moduloId])).get(moduloId) ??
        [],
      maxIntentos: version.maxIntentos,
      esperaMinutos: version.esperaEntreIntentosMinutos,
      ahora: new Date(),
    });
    if (!reintentos.puedeRendir) {
      throw new ConflictException(mensajeReintentos(reintentos));
    }

    // Filtra por `activa: true` en el PIVOT y en la PREGUNTA — a propósito
    // ASIMÉTRICO con SesionesService.registrar(), que no filtra por `activa`
    // en ninguno de los dos. Ahí una baja posterior no puede invalidar una
    // rendición ya hecha; acá es al revés: no tiene sentido servir un examen
    // nuevo con una pregunta que un admin ya desactivó o mandó a papelera. No
    // "arreglar" ninguno de los dos para que coincidan — son momentos
    // distintos (servir vs. corregir) con la respuesta correcta distinta.
    const pivots = await this.prisma.moduloVersionPregunta.findMany({
      where: {
        moduloVersionId: version.id,
        activa: true,
        pregunta: { activa: true },
      },
      select: {
        pregunta: {
          // Nunca se selecciona `respuestaCorrecta`: la garantía de que no
          // viaja al cliente no depende de que serializarPregunta() la
          // descarte bien, depende de que ni siquiera esté en el objeto.
          select: {
            id: true,
            texto: true,
            tipo: true,
            imagen: true,
            opciones: true,
          },
        },
      },
    });
    if (!pivots.length) {
      throw new ConflictException(
        `El módulo ${moduloId} no tiene preguntas activas para rendir`,
      );
    }

    // Cuántas sortear la decide la VERSIÓN. `null` significa "sin declarar" y
    // cae al default global — no cero, que dejaría el examen vacío (ver la
    // migración modulo_version_parametros_examen).
    //
    // Un pool más chico que ese número tampoco es un error: un módulo con 2
    // preguntas es raro pero rendible, y sortear() ya devuelve "las que haya"
    // cuando n supera el tamaño del pool.
    const elegidas = sortear(
      pivots.map((p) => p.pregunta),
      version.preguntasPorExamen ?? PREGUNTAS_POR_EXAMEN,
    );

    return {
      moduloId: modulo.id,
      moduloVersionId: version.id,
      modulo: { nombre: modulo.nombre, descripcion: modulo.descripcion },
      version: {
        anio: version.anio,
        mayor: version.mayor,
        menor: version.menor,
      },
      preguntas: elegidas.map(serializarPregunta),
    };
  }

  // Registra el resultado de una rendición. Delega TODO en
  // SesionesService.registrar() (corrección, umbral, idempotencia,
  // Asignacion.moduloVersionId) — acá no se recalcula ni se reinterpreta
  // nada de eso, sólo se arma el `usuarioId` (del token, nunca del body, ver
  // RegistrarSesionTabletDto) y se recorta la respuesta a lo que la pantalla
  // de Resultado necesita pintar. `duplicada` viaja aparte para que
  // TabletController decida el status HTTP (200/201) — no forma parte del
  // body que ve la tablet.
  async rendir(usuarioId: number, dto: RegistrarSesionTabletDto) {
    const sesion = await this.sesiones.registrar({ ...dto, usuarioId });

    return {
      duplicada: sesion.duplicada,
      resultado: {
        sesionId: sesion.id,
        correctas: sesion.correctas,
        total: sesion.total,
        porcentaje: sesion.porcentaje,
        aprobada: sesion.aprobada,
        umbralAprobacion: sesion.umbralAprobacion,
        // Recalculado DESPUÉS de registrar, así la pantalla de Resultado sabe si
        // ofrecer "Reintentar" o decir por qué no. Si aprobó, el contador ya se
        // reseteó y esto vuelve en OK — correcto: lo que la saca de pendientes
        // es la aprobación, no el tope.
        reintentos: await this.reintentosDe(usuarioId, dto.moduloVersionId),
      },
    };
  }

  // Estado de reintentos a partir de la versión que se acaba de rendir. Los
  // parámetros se leen de la versión ACTIVO del módulo y no de la rendida: son
  // las reglas del PRÓXIMO intento, y el próximo se rinde contra lo publicado
  // hoy. Si el módulo quedó sin ACTIVO (se archivó), no hay reglas que aplicar.
  private async reintentosDe(usuarioId: number, moduloVersionId: string) {
    const version = await this.prisma.moduloVersion.findUnique({
      where: { id: moduloVersionId },
      select: {
        moduloId: true,
        modulo: {
          select: {
            versiones: {
              where: { estado: 'ACTIVO' },
              select: {
                maxIntentos: true,
                esperaEntreIntentosMinutos: true,
              },
            },
          },
        },
      },
    });
    if (!version) return null;

    const activa = version.modulo.versiones[0];
    const sesiones = await this.sesionesPorModulo(usuarioId, [
      version.moduloId,
    ]);

    return evaluarReintentos({
      sesiones: sesiones.get(version.moduloId) ?? [],
      maxIntentos: activa?.maxIntentos ?? null,
      esperaMinutos: activa?.esperaEntreIntentosMinutos ?? null,
      ahora: new Date(),
    });
  }
}
