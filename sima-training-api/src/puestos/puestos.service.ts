import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePuestoDto } from './dto/create-puesto.dto';
import { UpdatePuestoDto } from './dto/update-puesto.dto';

@Injectable()
export class PuestosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePuestoDto) {
    await this.assertNombreDisponible(dto.nombre);
    return this.prisma.puesto.create({
      data: { ...dto, createdBy: 'backoffice' },
    });
  }

  findAll() {
    return this.prisma.puesto.findMany({ orderBy: { nombre: 'asc' } });
  }

  async update(id: string, dto: UpdatePuestoDto) {
    await this.assertExiste(id);
    if (dto.nombre !== undefined) {
      await this.assertNombreDisponible(dto.nombre, id);
    }
    return this.prisma.puesto.update({ where: { id }, data: { ...dto } });
  }

  private async assertExiste(id: string) {
    const puesto = await this.prisma.puesto.findUnique({ where: { id } });
    if (!puesto) {
      throw new NotFoundException(`Puesto ${id} no encontrado`);
    }
  }

  private async assertNombreDisponible(nombre: string, exceptId?: string) {
    const existente = await this.prisma.puesto.findUnique({
      where: { nombre },
    });
    if (existente && existente.id !== exceptId) {
      throw new ConflictException(
        `Ya existe un puesto con el nombre "${nombre}"`,
      );
    }
  }
}
