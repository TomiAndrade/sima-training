import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ModulosService } from '../modulos/modulos.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { FindAllPreguntasDto } from './dto/find-all-preguntas.dto';

@Injectable()
export class PreguntasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modulos: ModulosService,
  ) {}

  // TODO(sprint futuro): detección de preguntas duplicadas/similares
  // (pg_trgm o embeddings) antes de crear. Fuera de alcance de este sprint.
  async create(dto: CreatePreguntaDto) {
    const { etiquetaIds, opciones, ...rest } = dto;
    return this.prisma.pregunta.create({
      data: {
        ...rest,
        ...(opciones ? { opciones: opciones as Prisma.InputJsonValue } : {}),
        ...(etiquetaIds?.length
          ? {
              etiquetas: {
                create: etiquetaIds.map((etiquetaId) => ({ etiquetaId })),
              },
            }
          : {}),
      },
      include: { etiquetas: { include: { etiqueta: true } } },
    });
  }

  async findAll(query: FindAllPreguntasDto) {
    let versionIdsFiltro: string[] | undefined;
    if (query.moduloId?.length) {
      const versiones = await this.modulos.versionesVigentesDe(
        query.moduloId,
      );
      versionIdsFiltro = versiones.map((v) => v.id);
    }

    const where: Prisma.PreguntaWhereInput = {
      ...(query.q ? { texto: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.activa !== undefined ? { activa: query.activa } : {}),
      ...(query.etiqueta || query.categoria
        ? {
            etiquetas: {
              some: {
                ...(query.etiqueta ? { etiquetaId: query.etiqueta } : {}),
                ...(query.categoria
                  ? { etiqueta: { categoria: query.categoria } }
                  : {}),
              },
            },
          }
        : {}),
      ...(versionIdsFiltro
        ? { versiones: { some: { moduloVersionId: { in: versionIdsFiltro } } } }
        : {}),
    };

    const preguntas = await this.prisma.pregunta.findMany({
      where,
      include: { etiquetas: { include: { etiqueta: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return this.enriquecerConModulos(preguntas);
  }

  async findOne(id: string) {
    const pregunta = await this.prisma.pregunta.findUnique({
      where: { id },
      include: { etiquetas: { include: { etiqueta: true } } },
    });
    if (!pregunta) {
      throw new NotFoundException(`Pregunta ${id} no encontrada`);
    }
    return pregunta;
  }

  // Papelera global. activa=false: cascada a todos los pivots de la pregunta
  // (todas sus asignaciones, cualquier módulo). activa=true: NO restaura los
  // pivots (asimetría intencional; el admin reactiva módulo por módulo).
  async setActiva(id: string, activa: boolean) {
    await this.findOne(id);

    if (!activa) {
      return this.prisma.$transaction(async (tx) => {
        const pregunta = await tx.pregunta.update({
          where: { id },
          data: { activa: false },
          include: { etiquetas: { include: { etiqueta: true } } },
        });
        await tx.moduloVersionPregunta.updateMany({
          where: { preguntaId: id },
          data: { activa: false },
        });
        return pregunta;
      });
    }

    return this.prisma.pregunta.update({
      where: { id },
      data: { activa: true },
      include: { etiquetas: { include: { etiqueta: true } } },
    });
  }

  // Enriquece cada pregunta con los módulos a los que está asignada
  // actualmente (versión vigente de cada módulo), para la columna "Módulos"
  // del backoffice. Resuelve las versiones vigentes de TODOS los módulos una
  // sola vez y hace una única query de pivots, para evitar N+1.
  private async enriquecerConModulos<T extends { id: string }>(
    preguntas: T[],
  ): Promise<
    (T & {
      modulos: { moduloId: string; moduloNombre: string; activaEnModulo: boolean }[];
    })[]
  > {
    if (preguntas.length === 0) return [];

    const todosLosModulos = await this.modulos.findAll();
    const versiones = await this.modulos.versionesVigentesDe(
      todosLosModulos.map((m) => m.id),
    );
    if (versiones.length === 0) {
      return preguntas.map((p) => ({ ...p, modulos: [] }));
    }

    const pivots = await this.prisma.moduloVersionPregunta.findMany({
      where: {
        preguntaId: { in: preguntas.map((p) => p.id) },
        moduloVersionId: { in: versiones.map((v) => v.id) },
      },
      include: { moduloVersion: { include: { modulo: true } } },
    });

    const mapa = new Map<
      string,
      { moduloId: string; moduloNombre: string; activaEnModulo: boolean }[]
    >();
    for (const pivot of pivots) {
      const lista = mapa.get(pivot.preguntaId) ?? [];
      lista.push({
        moduloId: pivot.moduloVersion.modulo.id,
        moduloNombre: pivot.moduloVersion.modulo.nombre,
        activaEnModulo: pivot.activa,
      });
      mapa.set(pivot.preguntaId, lista);
    }

    return preguntas.map((p) => ({ ...p, modulos: mapa.get(p.id) ?? [] }));
  }
}
