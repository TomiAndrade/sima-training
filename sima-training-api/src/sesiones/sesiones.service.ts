import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  UMBRAL_APROBACION_DEFAULT,
  calcularResultado,
  esCorrecta,
} from './corregir';
import { RegistrarSesionDto } from './dto/registrar-sesion.dto';

@Injectable()
export class SesionesService {
  constructor(private readonly prisma: PrismaService) {}

  // Registra UN intento de rendición: corrige, persiste la Sesion con sus Respuesta
  // y —sólo si aprobó— completa Asignacion.moduloVersionId.
  //
  // Todo en una transacción: una sesión sin sus respuestas no significa nada, y la
  // asignación no puede quedar marcada como cumplida por una sesión que no se guardó.
  //
  // No llama a recalcular(): aprobar no crea ni revoca ninguna asignación. La vigente
  // sigue vigente (la regla la sigue pidiendo) y recalcular() ya la trata bien — no
  // la re-crea porque está cubierta, y no la revoca porque sigue requerida. Lo que
  // cambia es que a partir de ahora modulosAprobados() la cuenta como aprobada.
  async registrar(dto: RegistrarSesionDto, actor = 'tablet') {
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.findFirst({
        where: { id: dto.usuarioId, deletedAt: null },
        select: { id: true },
      });
      if (!usuario) {
        throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);
      }

      const version = await tx.moduloVersion.findUnique({
        where: { id: dto.moduloVersionId },
        select: { id: true, moduloId: true, estado: true },
      });
      if (!version) {
        throw new NotFoundException(
          `La versión de módulo ${dto.moduloVersionId} no existe`,
        );
      }
      // ARCHIVADO sí se acepta: una sesión sincronizada tarde (modo offline) puede
      // corresponder a una versión que se archivó mientras tanto, y lo que se rindió
      // se rindió. Un BORRADOR, en cambio, es trabajo en curso sin publicar —
      // rendirlo sería certificar contra algo que nadie aprobó todavía (el modo beta
      // del Sprint 3 sigue sin implementar).
      if (version.estado === 'BORRADOR') {
        throw new ConflictException(
          'No se puede rendir un BORRADOR: la versión todavía no está publicada',
        );
      }

      if (dto.iniciadaEn && dto.iniciadaEn > dto.finalizadaEn) {
        throw new BadRequestException(
          'iniciadaEn no puede ser posterior a finalizadaEn',
        );
      }

      const preguntaIds = dto.respuestas.map((r) => r.preguntaId);
      if (new Set(preguntaIds).size !== preguntaIds.length) {
        throw new BadRequestException(
          'Hay preguntas repetidas: cada pregunta se contesta una sola vez por intento',
        );
      }

      // Una sola query resuelve las dos cosas: que la pregunta PERTENEZCA a esta
      // versión y con qué respuesta hay que corregirla.
      //
      // No se exige `activa: true` en el pivot ni en la pregunta: desactivar una
      // pregunta o mandarla a papelera DESPUÉS no puede invalidar una rendición ya
      // hecha (y con el modo offline el intento puede ser anterior a la baja).
      const pivots = await tx.moduloVersionPregunta.findMany({
        where: {
          moduloVersionId: version.id,
          preguntaId: { in: preguntaIds },
        },
        select: {
          preguntaId: true,
          pregunta: { select: { respuestaCorrecta: true } },
        },
      });
      const porPregunta = new Map(
        pivots.map((p) => [p.preguntaId, p.pregunta]),
      );

      const ajenas = preguntaIds.filter((id) => !porPregunta.has(id));
      if (ajenas.length) {
        throw new BadRequestException(
          `Estas preguntas no pertenecen a la versión que se rindió: ${ajenas.join(', ')}`,
        );
      }

      // Una pregunta sin respuestaCorrecta no se puede corregir sola (hoy sólo
      // podría pasar con TEXTO_LIBRE, que está en el enum pero no lo usa ningún
      // módulo). Se rechaza en vez de contarla como incorrecta: puntuar 0 en
      // silencio le baja el score a alguien por un dato faltante nuestro. La
      // corrección manual necesitaría `Respuesta.correcta` nullable y un corrector
      // — no entra en esta story.
      const sinCorrecta = preguntaIds.filter(
        (id) => !porPregunta.get(id)?.respuestaCorrecta,
      );
      if (sinCorrecta.length) {
        throw new BadRequestException(
          `Estas preguntas no tienen respuesta correcta cargada y no se pueden corregir automáticamente: ${sinCorrecta.join(', ')}`,
        );
      }

      // La asignación que se viene a cumplir. Si el cliente no la mandó, se resuelve
      // la vigente de ese (usuario, módulo) — a lo sumo hay una, lo garantiza el
      // índice parcial asignaciones_usuario_modulo_vigente.
      const asignacion = await this.resolverAsignacion(
        tx,
        dto,
        version.moduloId,
      );

      const correcciones = dto.respuestas.map((respuesta) => ({
        preguntaId: respuesta.preguntaId,
        respuestaDada: respuesta.respuestaDada ?? null,
        correcta: esCorrecta(
          // El filtro de sinCorrecta de arriba ya garantiza que no es null.
          porPregunta.get(respuesta.preguntaId)!.respuestaCorrecta!,
          respuesta.respuestaDada,
        ),
      }));

      const umbralAprobacion = UMBRAL_APROBACION_DEFAULT;
      const resultado = calcularResultado(
        correcciones.map((c) => c.correcta),
        umbralAprobacion,
      );

      const sesion = await tx.sesion.create({
        data: {
          usuarioId: dto.usuarioId,
          moduloVersionId: version.id,
          asignacionId: asignacion?.id ?? null,
          iniciadaEn: dto.iniciadaEn,
          finalizadaEn: dto.finalizadaEn,
          ...resultado,
          umbralAprobacion,
          createdBy: actor,
          respuestas: { create: correcciones },
        },
        include: { respuestas: true },
      });

      // Sólo al APROBAR: el campo significa "con qué versión se cumplió esta
      // obligación", no "con cuál se intentó" (eso ya lo guarda cada Sesion). Un
      // intento desaprobado lo deja como estaba; una aprobación posterior sobre una
      // versión más nueva lo pisa. La asignación NO se revoca: sigue vigente porque
      // la regla la sigue pidiendo, y "pendiente" pasa a ser vigente-sin-aprobar.
      if (resultado.aprobada && asignacion) {
        await tx.asignacion.update({
          where: { id: asignacion.id },
          data: { moduloVersionId: version.id, updatedBy: actor },
        });
      }

      return sesion;
    });
  }

  private async resolverAsignacion(
    tx: Prisma.TransactionClient,
    dto: RegistrarSesionDto,
    moduloId: string,
  ) {
    if (!dto.asignacionId) {
      // Rendir sin asignación vigente es válido (la sesión vale igual y cuenta como
      // aprobación): por eso esto puede devolver null en vez de tirar.
      return tx.asignacion.findFirst({
        where: { usuarioId: dto.usuarioId, moduloId, revocadaAt: null },
        select: { id: true },
      });
    }

    const asignacion = await tx.asignacion.findUnique({
      where: { id: dto.asignacionId },
      select: {
        id: true,
        usuarioId: true,
        moduloId: true,
        revocadaAt: true,
      },
    });
    if (!asignacion) {
      throw new NotFoundException(
        `Asignación ${dto.asignacionId} no encontrada`,
      );
    }
    if (asignacion.usuarioId !== dto.usuarioId) {
      throw new BadRequestException(
        `La asignación ${dto.asignacionId} es de otra persona`,
      );
    }
    if (asignacion.moduloId !== moduloId) {
      throw new BadRequestException(
        `La asignación ${dto.asignacionId} es de otro módulo que el de la versión rendida`,
      );
    }
    if (asignacion.revocadaAt) {
      throw new ConflictException(
        `La asignación ${dto.asignacionId} está revocada`,
      );
    }
    return { id: asignacion.id };
  }
}
