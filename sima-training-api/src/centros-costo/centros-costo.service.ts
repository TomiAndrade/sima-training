import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCentroCostoDto } from './dto/create-centro-costo.dto';
import { UpdateCentroCostoDto } from './dto/update-centro-costo.dto';

@Injectable()
export class CentrosCostoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCentroCostoDto) {
    await this.assertNombreDisponible(dto.nombre);
    return this.prisma.centroCosto.create({
      data: { ...dto, createdBy: 'backoffice' },
    });
  }

  findAll() {
    return this.prisma.centroCosto.findMany({ orderBy: { nombre: 'asc' } });
  }

  async update(id: string, dto: UpdateCentroCostoDto) {
    await this.assertExiste(id);
    if (dto.nombre !== undefined) {
      await this.assertNombreDisponible(dto.nombre, id);
    }
    return this.prisma.centroCosto.update({ where: { id }, data: { ...dto } });
  }

  private async assertExiste(id: string) {
    const centroCosto = await this.prisma.centroCosto.findUnique({
      where: { id },
    });
    if (!centroCosto) {
      throw new NotFoundException(`Centro de costo ${id} no encontrado`);
    }
  }

  private async assertNombreDisponible(nombre: string, exceptId?: string) {
    const existente = await this.prisma.centroCosto.findUnique({
      where: { nombre },
    });
    if (existente && existente.id !== exceptId) {
      throw new ConflictException(
        `Ya existe un centro de costo con el nombre "${nombre}"`,
      );
    }
  }
}
