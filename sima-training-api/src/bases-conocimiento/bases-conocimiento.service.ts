import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBaseConocimientoDto } from './dto/create-base-conocimiento.dto';
import { CreateNivelDto } from './dto/create-nivel.dto';
import { FindBasesConocimientoDto } from './dto/find-bases-conocimiento.dto';
import { ReordenarNivelesDto } from './dto/reordenar-niveles.dto';
import { UpdateBaseConocimientoDto } from './dto/update-base-conocimiento.dto';
import { UpdateNivelDto } from './dto/update-nivel.dto';

// Forma única para listado y detalle: la escala ordenada + cuántas preguntas
// cuelgan de la base y de cada nivel. El backoffice usa esos conteos para saber
// qué se rompe antes de tocar la escala.
const BASE_INCLUDE = {
  niveles: {
    orderBy: { orden: 'asc' as const },
    include: { _count: { select: { preguntas: true } } },
  },
  _count: { select: { preguntas: true } },
};

@Injectable()
export class BasesConocimientoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBaseConocimientoDto) {
    await this.assertNombreDisponible(dto.nombre);
    await this.assertCodigoDisponible(dto.codigo);
    return this.prisma.baseConocimiento.create({
      data: { ...dto, createdBy: 'backoffice' },
      include: BASE_INCLUDE,
    });
  }

  // Sin ?activa= devuelve el catálogo completo (activas y dadas de baja), mismo
  // criterio que /puestos: hay consumidores que necesitan poder nombrar una
  // base ya elegida que después se desactivó.
  findAll(query: FindBasesConocimientoDto = {}) {
    return this.prisma.baseConocimiento.findMany({
      where: query.activa !== undefined ? { activa: query.activa } : {},
      include: BASE_INCLUDE,
      // `orden` es nullable (no toda base define uno), así que las que no lo
      // tienen van al final y desempatan por nombre.
      orderBy: [{ orden: { sort: 'asc', nulls: 'last' } }, { nombre: 'asc' }],
    });
  }

  async findOne(id: string) {
    const base = await this.prisma.baseConocimiento.findUnique({
      where: { id },
      include: BASE_INCLUDE,
    });
    if (!base) {
      throw new NotFoundException(`Base de conocimiento ${id} no encontrada`);
    }
    return base;
  }

  async update(id: string, dto: UpdateBaseConocimientoDto) {
    await this.findOne(id);
    if (dto.nombre !== undefined) {
      await this.assertNombreDisponible(dto.nombre, id);
    }
    if (dto.codigo !== undefined) {
      await this.assertCodigoDisponible(dto.codigo, id);
    }
    return this.prisma.baseConocimiento.update({
      where: { id },
      data: { ...dto },
      include: BASE_INCLUDE,
    });
  }

  async crearNivel(baseId: string, dto: CreateNivelDto) {
    await this.findOne(baseId);
    await this.assertNombreNivelDisponible(baseId, dto.nombre);

    const orden = dto.orden ?? (await this.siguienteOrden(baseId));
    const ocupado = await this.prisma.nivelBase.findFirst({
      where: { baseConocimientoId: baseId, orden },
    });
    if (ocupado) {
      throw new ConflictException(
        `El orden ${orden} ya está ocupado por el nivel "${ocupado.nombre}"; usá PUT /bases-conocimiento/:id/niveles/orden para reordenar la escala`,
      );
    }

    return this.prisma.nivelBase.create({
      data: { baseConocimientoId: baseId, nombre: dto.nombre, orden },
    });
  }

  // Sólo renombra: `orden` no se toca por acá (ver reordenarNiveles).
  async actualizarNivel(baseId: string, nivelId: string, dto: UpdateNivelDto) {
    const nivel = await this.assertNivelExiste(baseId, nivelId);
    if (dto.nombre !== nivel.nombre) {
      await this.assertNombreNivelDisponible(baseId, dto.nombre);
    }
    return this.prisma.nivelBase.update({
      where: { id: nivelId },
      data: { nombre: dto.nombre },
    });
  }

  // Reindexa la escala completa. El índice único (base_conocimiento_id, orden)
  // NO es diferible, así que mover niveles de a uno lo viola a mitad de camino
  // aunque todo esté en la misma transacción — el mismo problema que el
  // `principal` de VinculacionPuestoCentro.
  //
  // Se resuelve en dos pasadas cuyos rangos de valores no se solapan nunca:
  //   1) toda la escala pasa a negativos (viejos ≥ 0, nuevos < 0)
  //   2) cada nivel recibe su posición final (viejos < 0, nuevos ≥ 0)
  //
  // La pasada 1 va en $executeRaw porque `orden = -orden - 1` referencia la
  // propia columna, y el `data` de Prisma sólo acepta literales o sus
  // operaciones atómicas (increment/decrement/multiply/set) — ninguna
  // combinación de esas lo expresa en un solo update. La pasada 2 sí es Prisma
  // normal: cada fila recibe un literal distinto (su índice en la lista).
  async reordenarNiveles(baseId: string, dto: ReordenarNivelesDto) {
    await this.findOne(baseId);

    const actuales = await this.prisma.nivelBase.findMany({
      where: { baseConocimientoId: baseId },
      select: { id: true },
    });
    const idsActuales = new Set(actuales.map((n) => n.id));
    const idsPedidos = new Set(dto.nivelIds);

    if (idsPedidos.size !== dto.nivelIds.length) {
      throw new BadRequestException('nivelIds no puede repetir ids');
    }
    if (
      idsPedidos.size !== idsActuales.size ||
      dto.nivelIds.some((id) => !idsActuales.has(id))
    ) {
      throw new BadRequestException(
        'nivelIds debe contener exactamente los niveles de esta base, sin omitir ni agregar ninguno',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "niveles_base" SET "orden" = -"orden" - 1 WHERE "base_conocimiento_id" = ${baseId}`;
      for (const [i, nivelId] of dto.nivelIds.entries()) {
        await tx.nivelBase.update({
          where: { id: nivelId },
          data: { orden: i },
        });
      }
      return tx.nivelBase.findMany({
        where: { baseConocimientoId: baseId },
        orderBy: { orden: 'asc' },
      });
    });
  }

  // Un nivel con preguntas no se borra: la FK es ON DELETE RESTRICT, así que
  // Postgres lo rechazaría igual — pero con un error de constraint en vez de un
  // mensaje que se entienda. Para "dejar de usar" una base entera está su
  // `activa`; para vaciar un nivel hay que reclasificar sus preguntas primero.
  async eliminarNivel(baseId: string, nivelId: string) {
    await this.assertNivelExiste(baseId, nivelId);
    const preguntas = await this.prisma.pregunta.count({ where: { nivelId } });
    if (preguntas > 0) {
      throw new ConflictException(
        `El nivel tiene ${preguntas} pregunta(s) asignada(s); reclasificalas antes de eliminarlo`,
      );
    }
    return this.prisma.nivelBase.delete({ where: { id: nivelId } });
  }

  private async siguienteOrden(baseId: string) {
    const agg = await this.prisma.nivelBase.aggregate({
      where: { baseConocimientoId: baseId },
      _max: { orden: true },
    });
    return agg._max.orden === null ? 0 : agg._max.orden + 1;
  }

  private async assertNivelExiste(baseId: string, nivelId: string) {
    const nivel = await this.prisma.nivelBase.findUnique({
      where: { id: nivelId },
    });
    if (!nivel || nivel.baseConocimientoId !== baseId) {
      throw new NotFoundException(
        `Nivel ${nivelId} no encontrado en la base ${baseId}`,
      );
    }
    return nivel;
  }

  private async assertNombreNivelDisponible(baseId: string, nombre: string) {
    const existente = await this.prisma.nivelBase.findFirst({
      where: { baseConocimientoId: baseId, nombre },
    });
    if (existente) {
      throw new ConflictException(
        `Ya existe un nivel "${nombre}" en esta base de conocimiento`,
      );
    }
  }

  private async assertNombreDisponible(nombre: string, exceptId?: string) {
    const existente = await this.prisma.baseConocimiento.findUnique({
      where: { nombre },
    });
    if (existente && existente.id !== exceptId) {
      throw new ConflictException(
        `Ya existe una base de conocimiento con el nombre "${nombre}"`,
      );
    }
  }

  private async assertCodigoDisponible(codigo?: string, exceptId?: string) {
    if (!codigo) return;
    const existente = await this.prisma.baseConocimiento.findUnique({
      where: { codigo },
    });
    if (existente && existente.id !== exceptId) {
      throw new ConflictException(
        `Ya existe una base de conocimiento con el código "${codigo}"`,
      );
    }
  }
}
