import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReglaAsignacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AsignacionesService } from './asignaciones.service';
import { CreateReglaAsignacionDto } from './dto/create-regla-asignacion.dto';
import { FindReglasAsignacionDto } from './dto/find-reglas-asignacion.dto';
import { UpdateReglaAsignacionDto } from './dto/update-regla-asignacion.dto';

// Resumen del recálculo que dispara cualquier cambio de regla. Viaja en la
// respuesta de las cuatro mutaciones para que el backoffice pueda mostrar la
// consecuencia real ("2 asignaciones revocadas en 3 personas").
export interface ResumenRecalculo {
  usuarios: number;
  creadas: number;
  revocadas: number;
}

export interface ReglaConRecalculo {
  regla: ReglaAsignacion;
  recalculo: ResumenRecalculo;
}

// El default de Prisma para una transacción interactiva son 5 s. Acá adentro
// corre un recálculo por cada persona del centro (~3 queries cada uno), así que
// se sube el techo: el fan-out es acotado pero no es una sola query.
const TX_TIMEOUT_MS = 15_000;

// CRUD de las reglas de módulos obligatorios. Una regla tiene puesto + centro
// (par exacto) o sólo centro (aplica a todos los puestos de ese centro). Es la
// configuración que consume AsignacionesService.recalcular() para derivar las
// asignaciones AUTOMATICA.
@Injectable()
export class ReglasAsignacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asignaciones: AsignacionesService,
  ) {}

  // Alta de una regla. Si ya existe una fila con el mismo triple se reusa en vez
  // de crear otra ni romper con un P2002: si está desactivada se REACTIVA
  // (activo=true), y si está eliminada se REVIVE (deleted_at=null). "Volver a
  // agregar" una regla que ya estuvo es siempre traer de vuelta la misma fila.
  async create(
    dto: CreateReglaAsignacionDto,
    actor = 'backoffice',
  ): Promise<ReglaConRecalculo> {
    await this.assertReferenciasExisten(dto);

    return this.prisma.$transaction(
      async (tx) => {
        // findFirst, no findUnique: una regla de centro tiene puestoId NULL y una
        // clave única no se puede consultar por NULL. El `?? null` es lo que hace
        // que funcione para los dos alcances: Prisma traduce null a `IS NULL` y un
        // string a `= 'x'`. Con `undefined` omitiría la condición y reactivaría
        // CUALQUIER regla de ese centro+módulo.
        const triple = {
          puestoId: dto.puestoId ?? null,
          centroCostoId: dto.centroCostoId,
          moduloId: dto.moduloId,
        };

        // La viva PRIMERO, y recién si no hay se busca una eliminada. El orden no
        // es cosmético: una viva y una eliminada del mismo triple PUEDEN coexistir
        // (los índices parciales sólo prohíben dos vivas), y se llega ahí editando
        // —una regla viva se puede mover al módulo de una eliminada, porque la
        // detección de colisión las ignora—. Con una sola búsqueda sin ordenar,
        // esto podía agarrar la eliminada, revivirla y chocar contra la viva.
        const viva = await tx.reglaAsignacion.findFirst({
          where: { ...triple, deletedAt: null },
        });
        const eliminada = viva
          ? null
          : await tx.reglaAsignacion.findFirst({ where: triple });

        const existente = viva ?? eliminada;
        let regla: ReglaAsignacion;
        try {
          regla = existente
            ? await tx.reglaAsignacion.update({
                where: { id: existente.id },
                data: { activo: true, deletedAt: null, updatedBy: actor },
              })
            : await tx.reglaAsignacion.create({
                data: {
                  ...dto,
                  puestoId: dto.puestoId ?? null,
                  createdBy: actor,
                },
              });
        } catch (err) {
          // Red de seguridad: con las dos búsquedas de arriba el único camino que
          // queda es que otra sesión cree la misma regla en el medio.
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            throw new ConflictException(
              'Ya existe una regla para ese módulo con el mismo alcance',
            );
          }
          throw err;
        }

        const recalculo = await this.recalcularCentro(
          tx,
          regla.centroCostoId,
          actor,
        );
        return { regla, recalculo };
      },
      { timeout: TX_TIMEOUT_MS },
    );
  }

  findAll(query: FindReglasAsignacionDto) {
    const where: Prisma.ReglaAsignacionWhereInput = {
      // Una regla eliminada no se lista nunca (no hay filtro para verlas): la fila
      // se conserva por trazabilidad, no para mostrarla.
      deletedAt: null,
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

  // Edición parcial: el MÓDULO al que obliga la regla y/o su baja lógica.
  // El alcance (puesto + centro) no se edita a propósito: es dónde vive la regla
  // en el listado del backoffice, y moverla de lugar es eliminarla y crear otra.
  async update(
    id: string,
    dto: UpdateReglaAsignacionDto,
    actor = 'backoffice',
  ): Promise<ReglaConRecalculo> {
    if (dto.moduloId === undefined && dto.activo === undefined) {
      throw new BadRequestException(
        'Nada para actualizar: mandá `moduloId` y/o `activo`',
      );
    }
    if (dto.moduloId !== undefined) {
      await this.assertReferenciasExisten({ moduloId: dto.moduloId });
    }

    return this.prisma.$transaction(
      async (tx) => {
        const regla = await tx.reglaAsignacion.findUnique({ where: { id } });
        // Se filtra acá y no en el where para no perder el findUnique por PK. Una
        // regla eliminada no existe a ningún efecto: editarla es un 404.
        if (!regla || regla.deletedAt) {
          throw new NotFoundException(`La regla ${id} no existe`);
        }

        if (dto.moduloId !== undefined && dto.moduloId !== regla.moduloId) {
          await this.assertModuloLibre(tx, regla, dto.moduloId);
        }

        let actualizada: ReglaAsignacion;
        try {
          actualizada = await tx.reglaAsignacion.update({
            where: { id },
            data: {
              ...(dto.moduloId !== undefined ? { moduloId: dto.moduloId } : {}),
              ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
              updatedBy: actor,
            },
          });
        } catch (err) {
          // Red de seguridad: assertModuloLibre ya cubre el caso normal, pero si
          // otra sesión crea la misma regla en el medio el índice la frena acá.
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            throw new ConflictException(
              'Ya existe una regla para ese módulo con el mismo alcance',
            );
          }
          throw err;
        }

        const recalculo = await this.recalcularCentro(
          tx,
          actualizada.centroCostoId,
          actor,
        );
        return { regla: actualizada, recalculo };
      },
      { timeout: TX_TIMEOUT_MS },
    );
  }

  // Baja/alta lógica: la pausa reversible de una regla (la fila sigue visible en
  // el backoffice). Para sacarla del listado está remove().
  setActivo(
    id: string,
    activo: boolean,
    actor = 'backoffice',
  ): Promise<ReglaConRecalculo> {
    return this.update(id, { activo }, actor);
  }

  // Eliminar = BAJA LÓGICA (deletedAt), nunca un DELETE. La fila es la única
  // evidencia de por qué una persona tuvo que rendir un módulo, y de cara al
  // AuditLog ISO 9001 no puede desaparecer. Es un eje distinto de `activo`: una
  // regla desactivada sigue visible y se puede reactivar desde el backoffice, una
  // eliminada deja de existir a todos los efectos (listado, matching, índices).
  // El recálculo va después de la baja y en la misma transacción: el motor tiene
  // que leer la base ya sin la regla para revocar las AUTOMATICA que justificaba.
  async remove(id: string, actor = 'backoffice'): Promise<ReglaConRecalculo> {
    return this.prisma.$transaction(
      async (tx) => {
        const existente = await tx.reglaAsignacion.findUnique({
          where: { id },
        });
        if (!existente || existente.deletedAt) {
          throw new NotFoundException(`La regla ${id} no existe`);
        }

        // `activo` se deja como estaba: son dos ejes independientes, y si la regla
        // se revive (ver create) el revive es el que la vuelve a poner en true.
        const regla = await tx.reglaAsignacion.update({
          where: { id },
          data: { deletedAt: new Date(), updatedBy: actor },
        });

        const recalculo = await this.recalcularCentro(
          tx,
          regla.centroCostoId,
          actor,
        );
        return { regla, recalculo };
      },
      { timeout: TX_TIMEOUT_MS },
    );
  }

  // Recalcula a todas las personas que una regla de este centro puede alcanzar,
  // en la MISMA transacción que la cambió: si algo falla se revierte todo junto y
  // no quedan asignaciones derivadas de una regla que no se llegó a guardar.
  // Cierra la asimetría que había con el ABM de usuarios (que sí recalculaba al
  // tocar los pares de una persona).
  private async recalcularCentro(
    tx: Prisma.TransactionClient,
    centroCostoId: string,
    actor: string,
  ): Promise<ResumenRecalculo> {
    const usuarios = await this.usuariosAlcanzados(tx, centroCostoId);

    let creadas = 0;
    let revocadas = 0;
    for (const usuarioId of usuarios) {
      // recalcularEnTx (no recalcular(), que abre su propia transacción), mismo
      // criterio que UsuariosService.
      const res = await this.asignaciones.recalcularEnTx(tx, usuarioId, actor);
      creadas += res.creadas;
      revocadas += res.revocadas;
    }

    return { usuarios: usuarios.length, creadas, revocadas };
  }

  // Fan-out acotado: a quien alcanza una regla —de par exacto o de centro— es
  // siempre alguien con un par ACTIVO en ese centro de costo, así que el centro
  // alcanza como filtro para los dos alcances. No hace falta recorrer el padrón.
  // Se excluyen los usuarios dados de baja: recalcularEnTx los rechaza con un 404
  // que abortaría la transacción entera.
  private async usuariosAlcanzados(
    tx: Prisma.TransactionClient,
    centroCostoId: string,
  ): Promise<number[]> {
    const pares = await tx.vinculacionPuestoCentro.findMany({
      where: {
        activo: true,
        centroCostoId,
        vinculacion: { deletedAt: null, usuario: { deletedAt: null } },
      },
      select: { vinculacion: { select: { usuarioId: true } } },
    });
    return [...new Set(pares.map((par) => par.vinculacion.usuarioId))];
  }

  // El triple (alcance, centro, módulo) es único entre las reglas VIVAS. Al
  // cambiar el módulo hay que verificar a mano que el destino esté libre:
  // findFirst con `?? null` por lo mismo que en create() (una clave única no se
  // consulta por NULL, y los índices de esta tabla son parciales e invisibles
  // para Prisma). Una regla eliminada no cuenta como colisión — el índice
  // tampoco la considera, así que rechazar acá sería más estricto que la base.
  private async assertModuloLibre(
    tx: Prisma.TransactionClient,
    regla: ReglaAsignacion,
    moduloId: string,
  ) {
    const choque = await tx.reglaAsignacion.findFirst({
      where: {
        puestoId: regla.puestoId ?? null,
        centroCostoId: regla.centroCostoId,
        moduloId,
        id: { not: regla.id },
        deletedAt: null,
      },
    });
    if (choque) {
      throw new ConflictException(
        choque.activo
          ? 'Ya existe una regla para ese módulo con el mismo alcance'
          : 'Ya existe una regla para ese módulo con el mismo alcance, pero está desactivada: activala en vez de duplicarla',
      );
    }
  }

  // Valida puesto/centro/módulo antes de tocar la base: un id inexistente
  // reventaría como error de FK (500) en vez de 400. Valida SÓLO lo que viene:
  // sin puesto la regla es de centro (no hay nada que verificar, y un findUnique
  // con id undefined reventaría), y la edición manda únicamente el módulo.
  private async assertReferenciasExisten(dto: {
    puestoId?: string;
    centroCostoId?: string;
    moduloId?: string;
  }) {
    const [puesto, centro, modulo] = await Promise.all([
      dto.puestoId
        ? this.prisma.puesto.findUnique({
            where: { id: dto.puestoId },
            select: { id: true },
          })
        : Promise.resolve(null),
      dto.centroCostoId
        ? this.prisma.centroCosto.findUnique({
            where: { id: dto.centroCostoId },
            select: { id: true },
          })
        : Promise.resolve(null),
      dto.moduloId
        ? this.prisma.modulo.findUnique({
            where: { id: dto.moduloId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (dto.puestoId && !puesto) {
      throw new BadRequestException(`El puesto ${dto.puestoId} no existe`);
    }
    if (dto.centroCostoId && !centro) {
      throw new BadRequestException(
        `El centro de costo ${dto.centroCostoId} no existe`,
      );
    }
    if (dto.moduloId && !modulo) {
      throw new BadRequestException(`El módulo ${dto.moduloId} no existe`);
    }
  }
}
