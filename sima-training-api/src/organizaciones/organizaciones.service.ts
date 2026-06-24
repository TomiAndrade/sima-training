import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizacionDto } from './dto/create-organizacion.dto';
import { UpdateOrganizacionDto } from './dto/update-organizacion.dto';

@Injectable()
export class OrganizacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizacionDto) {
    await this.assertPadreExiste(dto.organizacionPadreId);
    return this.prisma.organizacion.create({ data: { ...dto } });
  }

  findAll() {
    return this.prisma.organizacion.findMany({ orderBy: { id: 'asc' } });
  }

  async findOne(id: number) {
    const org = await this.prisma.organizacion.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException(`Organización ${id} no encontrada`);
    }
    return org;
  }

  async update(id: number, dto: UpdateOrganizacionDto) {
    await this.findOne(id);
    if (dto.organizacionPadreId !== undefined) {
      if (dto.organizacionPadreId === id) {
        throw new BadRequestException(
          'Una organización no puede ser su propia organización padre',
        );
      }
      await this.assertPadreExiste(dto.organizacionPadreId);
    }
    return this.prisma.organizacion.update({ where: { id }, data: { ...dto } });
  }

  private async assertPadreExiste(padreId?: number | null) {
    if (padreId === undefined || padreId === null) return;
    const padre = await this.prisma.organizacion.findUnique({
      where: { id: padreId },
    });
    if (!padre) {
      throw new BadRequestException(
        `La organización padre ${padreId} no existe`,
      );
    }
  }
}
