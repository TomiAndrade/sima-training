import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuloVersion, Prisma } from '@prisma/client';
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

  // Lista todos los módulos para poblar el filtro del backoffice.
  findAll() {
    return this.prisma.modulo.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, nombre: true, descripcion: true },
    });
  }

  // Batch de ultimaOActivaVersion: resuelve la versión vigente de cada módulo
  // pedido en 2 queries fijas (no N+1). La usa PreguntasService para filtrar
  // y enriquecer preguntas por pertenencia a módulos.
  async versionesVigentesDe(moduloIds: string[]): Promise<ModuloVersion[]> {
    if (moduloIds.length === 0) return [];

    const activas = await this.prisma.moduloVersion.findMany({
      where: { moduloId: { in: moduloIds }, estado: 'ACTIVO' },
    });
    const resueltos = new Set(activas.map((v) => v.moduloId));
    const faltantes = moduloIds.filter((id) => !resueltos.has(id));
    if (faltantes.length === 0) return activas;

    const candidatas = await this.prisma.moduloVersion.findMany({
      where: { moduloId: { in: faltantes } },
      orderBy: { numeroVersion: 'desc' },
    });
    const porModulo = new Map<string, ModuloVersion>();
    for (const v of candidatas) {
      if (!porModulo.has(v.moduloId)) porModulo.set(v.moduloId, v);
    }
    return [...activas, ...porModulo.values()];
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

  // Baja lógica por módulo: activa/desactiva la asignación de la pregunta en la
  // versión vigente (la misma que muestra findOne). No crea una versión nueva.
  async setPreguntaActiva(
    moduloId: string,
    preguntaId: string,
    activa: boolean,
  ) {
    const version = await this.ultimaOActivaVersion(moduloId);
    if (!version) {
      throw new NotFoundException(`El módulo ${moduloId} no tiene versiones`);
    }

    try {
      return await this.prisma.moduloVersionPregunta.update({
        where: {
          moduloVersionId_preguntaId: {
            moduloVersionId: version.id,
            preguntaId,
          },
        },
        data: { activa },
        include: { pregunta: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException(
          `La pregunta ${preguntaId} no está asignada a este módulo`,
        );
      }
      throw err;
    }
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
