import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUsuarioDto) {
    await this.assertDniDisponible(dto.dni);
    await this.assertOrganizacionExiste(dto.organizacionId);
    const { datos, ...rest } = dto;
    return this.prisma.usuario.create({
      data: { ...rest, datos: (datos ?? {}) as Prisma.InputJsonValue },
    });
  }

  findAll() {
    return this.prisma.usuario.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, deletedAt: null },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }
    return usuario;
  }

  async update(id: number, dto: UpdateUsuarioDto) {
    await this.findOne(id);
    if (dto.dni !== undefined) {
      await this.assertDniDisponible(dto.dni, id);
    }
    if (dto.organizacionId !== undefined) {
      await this.assertOrganizacionExiste(dto.organizacionId);
    }
    const { datos, ...rest } = dto;
    return this.prisma.usuario.update({
      where: { id },
      data: {
        ...rest,
        ...(datos !== undefined
          ? { datos: datos as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  // Baja lógica: marca deletedAt, no borra la fila (trazabilidad).
  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async assertDniDisponible(dni: string, exceptId?: number) {
    const existente = await this.prisma.usuario.findFirst({
      where: {
        dni,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (existente) {
      throw new ConflictException(`Ya existe un usuario con el DNI ${dni}`);
    }
  }

  private async assertOrganizacionExiste(organizacionId?: number | null) {
    if (organizacionId === undefined || organizacionId === null) return;
    const org = await this.prisma.organizacion.findUnique({
      where: { id: organizacionId },
    });
    if (!org) {
      throw new BadRequestException(
        `La organización ${organizacionId} no existe`,
      );
    }
  }
}
