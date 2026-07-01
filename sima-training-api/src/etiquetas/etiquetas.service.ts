import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEtiquetaDto } from './dto/create-etiqueta.dto';

@Injectable()
export class EtiquetasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEtiquetaDto) {
    await this.assertNombreDisponible(dto.nombre);
    return this.prisma.etiqueta.create({ data: { ...dto } });
  }

  findAll() {
    return this.prisma.etiqueta.findMany({ orderBy: { nombre: 'asc' } });
  }

  private async assertNombreDisponible(nombre: string) {
    const existente = await this.prisma.etiqueta.findUnique({
      where: { nombre },
    });
    if (existente) {
      throw new ConflictException(
        `Ya existe una etiqueta con el nombre "${nombre}"`,
      );
    }
  }
}
