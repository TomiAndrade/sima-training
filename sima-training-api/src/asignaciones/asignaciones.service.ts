import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAsignacionDto } from './dto/create-asignacion.dto';

@Injectable()
export class AsignacionesService {
  constructor(private readonly prisma: PrismaService) {}

  // Lista las asignaciones de una persona (vigentes y revocadas). Trae el módulo
  // para poder mostrar el nombre sin un segundo request.
  findByUsuario(usuarioId: number) {
    return this.prisma.asignacion.findMany({
      where: { usuarioId },
      include: { modulo: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Alta MANUAL (la carga un admin). recalcular() nunca las toca. El índice
  // único parcial (una vigente por usuario+módulo) rechaza duplicar una vigente.
  async createManual(dto: CreateAsignacionDto, actor = 'backoffice') {
    await this.assertUsuarioExiste(dto.usuarioId);
    const modulo = await this.prisma.modulo.findUnique({
      where: { id: dto.moduloId },
      select: { id: true },
    });
    if (!modulo) {
      throw new BadRequestException(`El módulo ${dto.moduloId} no existe`);
    }
    try {
      return await this.prisma.asignacion.create({
        data: {
          usuarioId: dto.usuarioId,
          moduloId: dto.moduloId,
          origen: 'MANUAL',
          createdBy: actor,
        },
      });
    } catch (err) {
      // P2002: choca con el índice único parcial → ya hay una vigente de ese
      // módulo para esa persona (sea MANUAL o AUTOMATICA).
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `El usuario ${dto.usuarioId} ya tiene una asignación vigente del módulo ${dto.moduloId}`,
        );
      }
      throw err;
    }
  }

  // Revoca una asignación (nunca se borra). Idempotente: revocar una ya revocada
  // no la cambia.
  async revocar(id: string, actor = 'backoffice') {
    const asignacion = await this.prisma.asignacion.findUnique({
      where: { id },
    });
    if (!asignacion) {
      throw new NotFoundException(`Asignación ${id} no encontrada`);
    }
    if (asignacion.revocadaAt) {
      return asignacion;
    }
    return this.prisma.asignacion.update({
      where: { id },
      data: { revocadaAt: new Date(), updatedBy: actor },
    });
  }

  // Recalcula las asignaciones AUTOMATICA de una persona a partir de sus pares
  // (puesto, centro) activos y las reglas vigentes. Síncrono e idempotente:
  //   - crea las AUTOMATICA que faltan (unión de módulos de todos los pares),
  //   - revoca las AUTOMATICA que ya no corresponden a ningún par activo,
  //   - NUNCA toca las MANUAL.
  // Correrlo dos veces seguidas no crea duplicados ni revoca de más.
  async recalcular(usuarioId: number, actor = 'backoffice') {
    await this.assertUsuarioExiste(usuarioId);

    // 1. Pares (puesto, centro) ACTIVOS de la vinculación (no dada de baja).
    const pares = await this.prisma.vinculacionPuestoCentro.findMany({
      where: {
        activo: true,
        vinculacion: { usuarioId, deletedAt: null },
      },
      select: { puestoId: true, centroCostoId: true },
    });

    // 2. Unión de módulos obligatorios: reglas activas que matchean algún par.
    //    Un módulo pedido por dos pares aparece una sola vez (es un Set) → una
    //    sola asignación. Sin pares no hay nada requerido (evita un OR: []).
    const requeridos = new Set<string>();
    if (pares.length) {
      const reglas = await this.prisma.reglaAsignacion.findMany({
        where: {
          activo: true,
          OR: pares.map((par) => ({
            puestoId: par.puestoId,
            centroCostoId: par.centroCostoId,
          })),
        },
        select: { moduloId: true },
      });
      for (const regla of reglas) requeridos.add(regla.moduloId);
    }

    // 3. Módulos ya aprobados (HUECO — hoy vacío, ver modulosAprobados).
    const aprobados = await this.modulosAprobados(usuarioId);

    // 4. Asignaciones vigentes actuales.
    const vigentes = await this.prisma.asignacion.findMany({
      where: { usuarioId, revocadaAt: null },
      select: { id: true, moduloId: true, origen: true },
    });
    const modulosCubiertos = new Set(vigentes.map((a) => a.moduloId));

    // 5. Crear: requeridos que no estén aprobados ni ya cubiertos por una
    //    vigente (de cualquier origen — no se duplica sobre una MANUAL).
    const aCrear = [...requeridos].filter(
      (moduloId) => !aprobados.has(moduloId) && !modulosCubiertos.has(moduloId),
    );

    // 6. Revocar: vigentes AUTOMATICA cuyo módulo ya no está requerido por
    //    ningún par activo. Se usa `requeridos` (NO `requeridos − aprobados`):
    //    un módulo aprobado que un par sigue pidiendo no se revoca; sólo no se
    //    re-crea. Las MANUAL nunca entran acá.
    const aRevocar = vigentes.filter(
      (a) => a.origen === 'AUTOMATICA' && !requeridos.has(a.moduloId),
    );

    if (!aCrear.length && !aRevocar.length) {
      return { creadas: 0, revocadas: 0 };
    }

    const ahora = new Date();
    await this.prisma.$transaction(async (tx) => {
      if (aCrear.length) {
        await tx.asignacion.createMany({
          data: aCrear.map((moduloId) => ({
            usuarioId,
            moduloId,
            origen: 'AUTOMATICA' as const,
            createdBy: actor,
          })),
        });
      }
      if (aRevocar.length) {
        await tx.asignacion.updateMany({
          where: { id: { in: aRevocar.map((a) => a.id) } },
          data: { revocadaAt: ahora, updatedBy: actor },
        });
      }
    });

    return { creadas: aCrear.length, revocadas: aRevocar.length };
  }

  // HUECO EXPLÍCITO: módulos que el usuario YA APROBÓ. Todavía no existe el
  // registro de aprobaciones (se modela cuando la app tablet se conecte al
  // backend y exista el flujo de rendir evaluación). Devuelve vacío por ahora.
  // Cuando exista la entidad, se llena SOLO acá: recalcular() ya la consume en
  // el paso de creación, así que la regla "si ya aprobó, no vuelve a tener que
  // rendir aunque le corresponda por un par nuevo" (una recontratación) queda
  // cubierta sin reescribir la lógica de recalcular.
  private async modulosAprobados(usuarioId: number): Promise<Set<string>> {
    // Todavía no hay a quién consultarle: se ignora el usuarioId a propósito
    // hasta que exista la entidad de aprobaciones.
    void usuarioId;
    return new Set();
  }

  private async assertUsuarioExiste(usuarioId: number) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, deletedAt: null },
      select: { id: true },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);
    }
  }
}
