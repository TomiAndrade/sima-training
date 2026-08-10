import {
  ConflictException,
  Injectable,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { TipoPregunta } from '@prisma/client';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolverUrlImagen } from '../storage/url-imagen';
import { LoginTabletDto } from './dto/login-tablet.dto';
import { sortear } from './sorteo';

// Cuántas preguntas sortea un examen. Hoy replica el 3 que hardcodea la app
// tablet MOCKEADA (pickRandomQuestions en sima-check-app). Con
// ModuloVersionCriterio el pool de una versión puede ser mucho más grande, y 3
// puede quedar corto para certificar seguridad de verdad — queda anotado en
// docs/pendientes.md como candidato a columna por módulo (o por criterio,
// junto con la `cantidadPreguntas` que tampoco se resolvió). No se resuelve
// acá: esta story es conectar la tablet, no rediseñar el sorteo.
export const PREGUNTAS_POR_EXAMEN = 3;

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

  // El examen de un módulo: sortea PREGUNTAS_POR_EXAMEN preguntas de la
  // versión ACTIVO y las serializa sin `respuestaCorrecta` — ver
  // serializarPregunta().
  async examen(moduloId: string) {
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
          select: { id: true, anio: true, mayor: true, menor: true },
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

    // Menos preguntas activas que PREGUNTAS_POR_EXAMEN no es un error: un
    // módulo con 2 preguntas es raro pero rendible. sortear() ya devuelve
    // "las que haya" cuando n supera el tamaño del pool.
    const elegidas = sortear(
      pivots.map((p) => p.pregunta),
      PREGUNTAS_POR_EXAMEN,
    );

    return {
      moduloId: modulo.id,
      moduloVersionId: version.id,
      modulo: { nombre: modulo.nombre, descripcion: modulo.descripcion },
      version: { anio: version.anio, mayor: version.mayor, menor: version.menor },
      preguntas: elegidas.map(serializarPregunta),
    };
  }
}

// Traduce una Pregunta del banco a lo que se manda a la tablet. CRÍTICO:
// `respuestaCorrecta` no entra por diseño (ver el select de arriba, que ni
// siquiera la trae) — todo lo que devuelve esta función se ve abriendo las
// devtools del examen.
function serializarPregunta(pregunta: {
  id: string;
  texto: string;
  tipo: TipoPregunta;
  imagen: string | null;
  opciones: unknown;
}) {
  return {
    id: pregunta.id,
    texto: pregunta.texto,
    tipo: pregunta.tipo,
    imagen: pregunta.imagen
      ? { clave: pregunta.imagen, url: resolverUrlImagen(pregunta.imagen) }
      : null,
    opciones: serializarOpciones(pregunta.tipo, pregunta.opciones),
  };
}

// OPCION_MULTIPLE / VERDADERO_FALSO: el jsonb tal cual (array de strings).
// OPCIONES_IMAGEN: cada string del jsonb es una CLAVE de storage — se traduce
// a { clave, url } (la app muestra `url` y manda `clave` de vuelta como
// respuesta; corregir.ts compara esa clave cruda, no la URL armada).
function serializarOpciones(tipo: TipoPregunta, opciones: unknown) {
  const lista = Array.isArray(opciones) ? (opciones as string[]) : [];
  if (tipo === 'OPCIONES_IMAGEN') {
    return lista.map((clave) => ({ clave, url: resolverUrlImagen(clave) }));
  }
  return lista;
}
