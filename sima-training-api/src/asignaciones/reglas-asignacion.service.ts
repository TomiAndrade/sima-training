import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReglaAsignacionDto } from './dto/create-regla-asignacion.dto';
import { FindReglasAsignacionDto } from './dto/find-reglas-asignacion.dto';

// CRUD de las reglas de módulos obligatorios por par (puesto, centro de costo).
// Es la configuración que consume AsignacionesService.recalcular() para derivar
// las asignaciones AUTOMATICA.
@Injectable()
export class ReglasAsignacionService {
  constructor(private readonly prisma: PrismaService) {}

  // Alta de una regla. El @unique del triple (puesto, centro, módulo) impide
  // duplicados: si ya existe una fila para ese triple, se REACTIVA (activo=true)
  // en vez de crear otra ni romper con un P2002 — "volver a agregar" una regla
  // dada de baja es reactivarla.
  async create(dto: CreateReglaAsignacionDto, actor = 'backoffice') {
    await this.assertReferenciasExisten(dto);

    const existente = await this.prisma.reglaAsignacion.findUnique({
      where: {
        puestoId_centroCostoId_moduloId: {
          puestoId: dto.puestoId,
          centroCostoId: dto.centroCostoId,
          moduloId: dto.moduloId,
        },
      },
    });

    if (existente) {
      return this.prisma.reglaAsignacion.update({
        where: { id: existente.id },
        data: { activo: true, updatedBy: actor },
      });
    }

    return this.prisma.reglaAsignacion.create({
      data: { ...dto, createdBy: actor },
    });
  }

  findAll(query: FindReglasAsignacionDto) {
    const where: Prisma.ReglaAsignacionWhereInput = {
      ...(query.puestoId ? { puestoId: query.puestoId } : {}),
      ...(query.centroCostoId ? { centroCostoId: query.centroCostoId } : {}),
      ...(query.moduloId ? { moduloId: query.moduloId } : {}),
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
    };
    return this.prisma.reglaAsignacion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Baja/alta lógica. No se editan puesto/centro/módulo: para cambiar el triple
  // se crea otra regla.
  async setActivo(id: string, activo: boolean, actor = 'backoffice') {
    await this.assertExiste(id);
    return this.prisma.reglaAsignacion.update({
      where: { id },
      data: { activo, updatedBy: actor },
    });
  }

  private async assertExiste(id: string) {
    const regla = await this.prisma.reglaAsignacion.findUnique({
      where: { id },
    });
    if (!regla) {
      throw new BadRequestException(`La regla ${id} no existe`);
    }
  }

  // Valida puesto/centro/módulo antes de tocar la base: un id inexistente
  // reventaría como error de FK (500) en vez de 400.
  private async assertReferenciasExisten(dto: CreateReglaAsignacionDto) {
    const [puesto, centro, modulo] = await Promise.all([
      this.prisma.puesto.findUnique({
        where: { id: dto.puestoId },
        select: { id: true },
      }),
      this.prisma.centroCosto.findUnique({
        where: { id: dto.centroCostoId },
        select: { id: true },
      }),
      this.prisma.modulo.findUnique({
        where: { id: dto.moduloId },
        select: { id: true },
      }),
    ]);
    if (!puesto) {
      throw new BadRequestException(`El puesto ${dto.puestoId} no existe`);
    }
    if (!centro) {
      throw new BadRequestException(
        `El centro de costo ${dto.centroCostoId} no existe`,
      );
    }
    if (!modulo) {
      throw new BadRequestException(`El módulo ${dto.moduloId} no existe`);
    }
  }
}
