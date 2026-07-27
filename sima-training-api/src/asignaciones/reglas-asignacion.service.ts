import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReglaAsignacionDto } from './dto/create-regla-asignacion.dto';
import { FindReglasAsignacionDto } from './dto/find-reglas-asignacion.dto';

// CRUD de las reglas de módulos obligatorios. Una regla tiene puesto + centro
// (par exacto) o sólo centro (aplica a todos los puestos de ese centro). Es la
// configuración que consume AsignacionesService.recalcular() para derivar las
// asignaciones AUTOMATICA.
@Injectable()
export class ReglasAsignacionService {
  constructor(private readonly prisma: PrismaService) {}

  // Alta de una regla. Si ya existe una fila igual (mismo alcance, centro y
  // módulo), se REACTIVA (activo=true) en vez de crear otra ni romper con un
  // P2002 — "volver a agregar" una regla dada de baja es reactivarla.
  async create(dto: CreateReglaAsignacionDto, actor = 'backoffice') {
    await this.assertReferenciasExisten(dto);

    // findFirst, no findUnique: una regla de centro tiene puestoId NULL y una
    // clave única no se puede consultar por NULL. Los dos índices (el @unique del
    // triple para las reglas con puesto, el parcial
    // reglas_asignacion_centro_modulo_sin_puesto para las de centro) garantizan
    // que esto nunca pueda encontrar más de una fila.
    const existente = await this.prisma.reglaAsignacion.findFirst({
      where: {
        // El `?? null` es lo que hace que funcione para los dos alcances: Prisma
        // traduce null a `IS NULL` y un string a `= 'x'`. Con `undefined` omitiría
        // la condición y reactivaría CUALQUIER regla de ese centro+módulo.
        puestoId: dto.puestoId ?? null,
        centroCostoId: dto.centroCostoId,
        moduloId: dto.moduloId,
      },
    });

    if (existente) {
      return this.prisma.reglaAsignacion.update({
        where: { id: existente.id },
        data: { activo: true, updatedBy: actor },
      });
    }

    return this.prisma.reglaAsignacion.create({
      data: { ...dto, puestoId: dto.puestoId ?? null, createdBy: actor },
    });
  }

  findAll(query: FindReglasAsignacionDto) {
    const where: Prisma.ReglaAsignacionWhereInput = {
      // ?puestoId= es literal: trae SÓLO las reglas de ese puesto, no las de centro
      // (que no tienen puesto). Para "todo lo que le aplica a un puesto en un
      // centro" se combina este filtro con ?alcance=CENTRO&centroCostoId=.
      ...(query.puestoId ? { puestoId: query.puestoId } : {}),
      ...(query.centroCostoId ? { centroCostoId: query.centroCostoId } : {}),
      ...(query.moduloId ? { moduloId: query.moduloId } : {}),
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
      // ?alcance= distingue los dos tipos de regla. Ausente = trae las dos.
      // Va en un AND y no como otra clave `puestoId` al ras: en un spread la clave
      // repetida PISA a la anterior, así que ?puestoId=X&alcance=CENTRO habría
      // devuelto todas las reglas de centro ignorando el puesto. Con el AND esa
      // combinación contradictoria se traduce a `puesto_id = X AND puesto_id IS
      // NULL` y devuelve [], que es la respuesta honesta.
      ...(query.alcance
        ? {
            AND:
              query.alcance === 'CENTRO'
                ? { puestoId: null }
                : { puestoId: { not: null } },
          }
        : {}),
    };
    return this.prisma.reglaAsignacion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Baja/alta lógica. No se editan puesto/centro/módulo: para cambiar el alcance
  // o el módulo se crea otra regla.
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
  // reventaría como error de FK (500) en vez de 400. El puesto sólo se valida si
  // vino: sin puesto la regla es de centro, no hay nada que verificar (y un
  // findUnique con id undefined reventaría).
  private async assertReferenciasExisten(dto: CreateReglaAsignacionDto) {
    const [puesto, centro, modulo] = await Promise.all([
      dto.puestoId
        ? this.prisma.puesto.findUnique({
            where: { id: dto.puestoId },
            select: { id: true },
          })
        : Promise.resolve(null),
      this.prisma.centroCosto.findUnique({
        where: { id: dto.centroCostoId },
        select: { id: true },
      }),
      this.prisma.modulo.findUnique({
        where: { id: dto.moduloId },
        select: { id: true },
      }),
    ]);
    if (dto.puestoId && !puesto) {
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
