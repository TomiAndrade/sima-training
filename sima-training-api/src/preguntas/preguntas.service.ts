import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { FindAllPreguntasDto } from './dto/find-all-preguntas.dto';

@Injectable()
export class PreguntasService {
  constructor(private readonly prisma: PrismaService) {}

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

  findAll(query: FindAllPreguntasDto) {
    const where: Prisma.PreguntaWhereInput = {
      ...(query.q ? { texto: { contains: query.q, mode: 'insensitive' } } : {}),
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
    };

    return this.prisma.pregunta.findMany({
      where,
      include: { etiquetas: { include: { etiqueta: true } } },
      orderBy: { createdAt: 'desc' },
    });
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
}
