import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsuarioDto, ParPuestoCentroDto } from './dto/create-usuario.dto';
import { FindAllUsuariosDto } from './dto/find-all-usuarios.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { motivoRolNoPermitido } from './matriz-rol-organizacion';

// Include común a findAll/findOne: la vinculación con su organización y sus
// pares (puesto, centro). Lista y detalle devuelven la misma forma para no
// obligar al frontend a manejar dos.
const USUARIO_INCLUDE = {
  vinculacion: {
    include: {
      organizacion: true,
      puestosCentros: { include: { puesto: true, centroCosto: true } },
    },
  },
} satisfies Prisma.UsuarioInclude;

type UsuarioConVinculacion = Prisma.UsuarioGetPayload<{
  include: typeof USUARIO_INCLUDE;
}>;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  // `actor` va a created_by/updated_by: 'backoffice' en el ABM, 'import' cuando
  // la llama ImportService.
  async create(dto: CreateUsuarioDto, actor = 'backoffice') {
    const { datos, vinculacion, ...identidad } = dto;
    const pares = await this.paresValidados(vinculacion.pares);
    await this.assertRolPermitido(vinculacion.organizacionId, vinculacion.rol);

    const datosJson = (datos ?? {}) as Prisma.InputJsonValue;
    const puestosCentros = this.paresACrear(pares, actor);

    // Si existe una fila dada de baja con el mismo DNI, se reactiva (revive)
    // en vez de crear una nueva: respeta el constraint @unique sobre dni y
    // mantiene id e historial. El DNI lo ocupa la fila soft-deleted.
    const dadoDeBaja = await this.prisma.usuario.findFirst({
      where: { dni: dto.dni, deletedAt: { not: null } },
      select: { id: true },
    });
    if (dadoDeBaja) {
      return this.prisma.$transaction(async (tx) => {
        // Los pares viejos se van con la baja: la fila revive con los que trae
        // el alta. Borrar antes de crear (misma transacción) evita chocar con
        // el índice único parcial de `principal`.
        await tx.vinculacionPuestoCentro.deleteMany({
          where: { vinculacion: { usuarioId: dadoDeBaja.id } },
        });
        const revivido = await tx.usuario.update({
          where: { id: dadoDeBaja.id },
          data: {
            ...identidad,
            datos: datosJson,
            deletedAt: null,
            updatedBy: actor,
            vinculacion: {
              upsert: {
                create: {
                  organizacionId: vinculacion.organizacionId,
                  rol: vinculacion.rol,
                  createdBy: actor,
                  puestosCentros: { create: puestosCentros },
                },
                update: {
                  organizacionId: vinculacion.organizacionId,
                  rol: vinculacion.rol,
                  activa: true,
                  deletedAt: null,
                  updatedBy: actor,
                  puestosCentros: { create: puestosCentros },
                },
              },
            },
          },
          include: USUARIO_INCLUDE,
        });
        return this.aRespuesta(revivido);
      });
    }

    await this.assertDniDisponible(dto.dni);
    const creado = await this.prisma.usuario.create({
      data: {
        ...identidad,
        datos: datosJson,
        createdBy: actor,
        vinculacion: {
          create: {
            organizacionId: vinculacion.organizacionId,
            rol: vinculacion.rol,
            createdBy: actor,
            puestosCentros: { create: puestosCentros },
          },
        },
      },
      include: USUARIO_INCLUDE,
    });
    return this.aRespuesta(creado);
  }

  async findAll(query: FindAllUsuariosDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    // Filtro por par (puesto y/o centro): un par desactivado no cuenta como
    // "ejerce ese puesto en ese centro".
    const porPar: Prisma.VinculacionPuestoCentroWhereInput = {
      ...(query.puestoId ? { puestoId: query.puestoId } : {}),
      ...(query.centroCostoId ? { centroCostoId: query.centroCostoId } : {}),
    };
    const porVinculacion: Prisma.VinculacionWhereInput = {
      ...(query.organizacionId ? { organizacionId: query.organizacionId } : {}),
      ...(query.rol ? { rol: query.rol } : {}),
      ...(Object.keys(porPar).length
        ? { puestosCentros: { some: { ...porPar, activo: true } } }
        : {}),
    };

    // La condición sobre `vinculacion` se agrega SOLO si hay algún filtro. Sin
    // filtros no se toca, así el listado sigue mostrando a quien todavía no
    // tiene ningún par cargado (el pivote arranca vacío) — filtrar por
    // centro/puesto es lo único que los deja afuera.
    const where: Prisma.UsuarioWhereInput = {
      deletedAt: null,
      ...(Object.keys(porVinculacion).length
        ? { vinculacion: porVinculacion }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.usuario.findMany({
        where,
        include: USUARIO_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.usuario.count({ where }),
    ]);

    return {
      data: data.map((usuario) => this.aRespuesta(usuario)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: number) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, deletedAt: null },
      include: USUARIO_INCLUDE,
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }
    return this.aRespuesta(usuario);
  }

  async update(id: number, dto: UpdateUsuarioDto, actor = 'backoffice') {
    const actual = await this.prisma.usuario.findFirst({
      where: { id, deletedAt: null },
      include: USUARIO_INCLUDE,
    });
    if (!actual) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }

    const { datos, vinculacion, ...identidad } = dto;
    if (identidad.dni !== undefined) {
      await this.assertDniDisponible(identidad.dni, id);
    }

    let puestosCentros: ReturnType<UsuariosService['paresACrear']> | undefined;
    let organizacionId: number | undefined;
    let rol: RolUsuario | undefined;

    if (vinculacion) {
      // La matriz se valida contra el estado RESULTANTE: cambiar solo el rol
      // (o solo la organización) también puede romperla.
      organizacionId =
        vinculacion.organizacionId ?? actual.vinculacion?.organizacionId;
      rol = vinculacion.rol ?? actual.vinculacion?.rol;
      if (organizacionId === undefined || rol === undefined) {
        throw new BadRequestException(
          'La vinculación necesita organización y rol',
        );
      }
      await this.assertRolPermitido(organizacionId, rol);
      if (vinculacion.pares) {
        puestosCentros = this.paresACrear(
          await this.paresValidados(vinculacion.pares),
          actor,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (puestosCentros) {
        // Reemplazo completo del set de pares. El borrado va primero y en la
        // misma transacción: el índice único parcial de `principal` no es
        // diferible, así que borrar y crear no pueden cruzarse.
        await tx.vinculacionPuestoCentro.deleteMany({
          where: { vinculacion: { usuarioId: id } },
        });
      }
      const actualizado = await tx.usuario.update({
        where: { id },
        data: {
          ...identidad,
          ...(datos !== undefined
            ? { datos: datos as Prisma.InputJsonValue }
            : {}),
          updatedBy: actor,
          ...(vinculacion && organizacionId !== undefined && rol !== undefined
            ? {
                vinculacion: {
                  upsert: {
                    create: {
                      organizacionId,
                      rol,
                      createdBy: actor,
                      ...(puestosCentros
                        ? { puestosCentros: { create: puestosCentros } }
                        : {}),
                    },
                    update: {
                      organizacionId,
                      rol,
                      updatedBy: actor,
                      ...(puestosCentros
                        ? { puestosCentros: { create: puestosCentros } }
                        : {}),
                    },
                  },
                },
              }
            : {}),
        },
        include: USUARIO_INCLUDE,
      });
      return this.aRespuesta(actualizado);
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

  // Forma de respuesta: rol y organización van ANIDADOS dentro de `vinculacion`
  // (ya no son campos planos de Usuario), y el par principal se expone aparte
  // para que el listado tenga una sola fila puesto/centro que mostrar.
  private aRespuesta(usuario: UsuarioConVinculacion) {
    const { vinculacion, ...resto } = usuario;
    if (!vinculacion) return { ...resto, vinculacion: null };

    const { puestosCentros, ...datosVinculacion } = vinculacion;
    const pares = puestosCentros.map((par) => ({
      puesto: par.puesto,
      centroCosto: par.centroCosto,
      principal: par.principal,
      activo: par.activo,
    }));

    return {
      ...resto,
      vinculacion: {
        ...datosVinculacion,
        // Null cuando todavía no hay ningún par cargado. El alumno rinde los
        // módulos de TODOS sus pares: éste es solo el que se muestra.
        parPrincipal: pares.find((par) => par.principal) ?? null,
        pares,
      },
    };
  }

  // El primer par de una vinculación queda como principal. Es únicamente el que
  // se muestra en el listado — no interviene en ninguna regla de capacitación —,
  // así que no hay herencia automática ni promoción de otro par cuando éste se
  // desactiva.
  private paresACrear(pares: ParPuestoCentroDto[], actor: string) {
    return pares.map((par, i) => ({
      puestoId: par.puestoId,
      centroCostoId: par.centroCostoId,
      principal: i === 0,
      createdBy: actor,
    }));
  }

  // Valida los pares antes de tocar la base: un puesto o centro inexistente
  // reventaría como error de FK (500) en vez de 400, y un par repetido como
  // violación del PK compuesto.
  private async paresValidados(pares?: ParPuestoCentroDto[]) {
    if (!pares?.length) return [];

    const claves = new Set(
      pares.map((par) => `${par.puestoId}|${par.centroCostoId}`),
    );
    if (claves.size !== pares.length) {
      throw new BadRequestException(
        'Hay pares (puesto, centro de costo) repetidos',
      );
    }

    const puestoIds = [...new Set(pares.map((par) => par.puestoId))];
    const centroIds = [...new Set(pares.map((par) => par.centroCostoId))];
    const [puestos, centros] = await Promise.all([
      this.prisma.puesto.findMany({
        where: { id: { in: puestoIds } },
        select: { id: true },
      }),
      this.prisma.centroCosto.findMany({
        where: { id: { in: centroIds } },
        select: { id: true },
      }),
    ]);

    const puestoFaltante = puestoIds.find(
      (id) => !puestos.some((puesto) => puesto.id === id),
    );
    if (puestoFaltante) {
      throw new BadRequestException(`El puesto ${puestoFaltante} no existe`);
    }
    const centroFaltante = centroIds.find(
      (id) => !centros.some((centro) => centro.id === id),
    );
    if (centroFaltante) {
      throw new BadRequestException(
        `El centro de costo ${centroFaltante} no existe`,
      );
    }

    return pares;
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

  // Matriz tipo-de-organización ↔ rol. Vive acá (y no en el DTO) porque cruza
  // dos tablas: el rol está en Vinculacion y el tipo en Organizacion.
  private async assertRolPermitido(organizacionId: number, rol: RolUsuario) {
    const organizacion = await this.prisma.organizacion.findUnique({
      where: { id: organizacionId },
      select: { tipo: true },
    });
    if (!organizacion) {
      throw new BadRequestException(
        `La organización ${organizacionId} no existe`,
      );
    }
    const motivo = motivoRolNoPermitido(organizacion.tipo, rol);
    if (motivo) {
      throw new BadRequestException(motivo);
    }
  }
}
