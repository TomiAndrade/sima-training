import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AsignarPreguntaItemDto } from './dto/asignar-preguntas.dto';
import { CreateModuloDto } from './dto/create-modulo.dto';

@Injectable()
export class ModulosService {
  constructor(private readonly prisma: PrismaService) {}

  // Crea el módulo y su ModuloVersion v1 en BORRADOR (una sola operación atómica).
  create(dto: CreateModuloDto) {
    return this.prisma.modulo.create({
      data: {
        ...dto,
        versiones: { create: { numeroVersion: 1 } },
      },
      include: { versiones: true },
    });
  }

  async findOne(id: string) {
    const modulo = await this.prisma.modulo.findUnique({ where: { id } });
    if (!modulo) {
      throw new NotFoundException(`Módulo ${id} no encontrado`);
    }

    const version = await this.ultimaOActivaVersion(id);
    const preguntas = version
      ? await this.prisma.moduloVersionPregunta.findMany({
          where: { moduloVersionId: version.id },
          include: { pregunta: true },
          orderBy: { orden: 'asc' },
        })
      : [];

    return { ...modulo, version, preguntas };
  }

  findVersiones(id: string) {
    return this.prisma.moduloVersion.findMany({
      where: { moduloId: id },
      orderBy: { numeroVersion: 'asc' },
    });
  }

  async asignarPreguntas(moduloId: string, items: AsignarPreguntaItemDto[]) {
    const borrador = await this.prisma.moduloVersion.findFirst({
      where: { moduloId, estado: 'BORRADOR' },
    });
    if (!borrador) {
      throw new NotFoundException(
        `El módulo ${moduloId} no tiene una versión en BORRADOR`,
      );
    }

    await this.assertPreguntasExisten(items.map((i) => i.preguntaId));

    try {
      await this.prisma.moduloVersionPregunta.createMany({
        data: items.map((item) => ({
          moduloVersionId: borrador.id,
          preguntaId: item.preguntaId,
          orden: item.orden,
          obligatoria: item.obligatoria ?? true,
        })),
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Una o más preguntas ya están asignadas a esta versión del módulo',
        );
      }
      throw err;
    }

    return this.prisma.moduloVersionPregunta.findMany({
      where: { moduloVersionId: borrador.id },
      include: { pregunta: true },
      orderBy: { orden: 'asc' },
    });
  }

  private async ultimaOActivaVersion(moduloId: string) {
    const activa = await this.prisma.moduloVersion.findFirst({
      where: { moduloId, estado: 'ACTIVO' },
    });
    if (activa) return activa;

    return this.prisma.moduloVersion.findFirst({
      where: { moduloId },
      orderBy: { numeroVersion: 'desc' },
    });
  }

  private async assertPreguntasExisten(preguntaIds: string[]) {
    const encontradas = await this.prisma.pregunta.count({
      where: { id: { in: preguntaIds } },
    });
    if (encontradas !== new Set(preguntaIds).size) {
      throw new NotFoundException(
        'Alguna de las preguntas indicadas no existe',
      );
    }
  }
}
