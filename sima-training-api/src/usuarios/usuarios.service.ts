import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { FindAllUsuariosDto } from './dto/find-all-usuarios.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUsuarioDto) {
    await this.assertOrganizacionExiste(dto.organizacionId);
    const { datos, ...rest } = dto;

    // Si existe una fila dada de baja con el mismo DNI, se reactiva (revive)
    // en vez de crear una nueva: respeta el constraint @unique sobre dni y
    // mantiene id e historial. El DNI lo ocupa la fila soft-deleted.
    const dadoDeBaja = await this.prisma.usuario.findFirst({
      where: { dni: dto.dni, deletedAt: { not: null } },
    });
    if (dadoDeBaja) {
      return this.prisma.usuario.update({
        where: { id: dadoDeBaja.id },
        data: {
          ...rest,
          datos: (datos ?? {}) as Prisma.InputJsonValue,
          deletedAt: null,
        },
      });
    }

    await this.assertDniDisponible(dto.dni);
    return this.prisma.usuario.create({
      data: { ...rest, datos: (datos ?? {}) as Prisma.InputJsonValue },
    });
  }

  async findAll(query: FindAllUsuariosDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.UsuarioWhereInput = {
      deletedAt: null,
      ...(query.clasificacion ? { clasificacion: query.clasificacion } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.usuario.findMany({
        where,
        include: { organizacion: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.usuario.count({ where }),
    ]);

    return { data, total, page, limit };
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
