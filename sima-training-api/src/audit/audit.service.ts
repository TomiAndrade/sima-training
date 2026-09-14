import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditLog, Prisma, RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActorIdentidad } from './actor-de-identidad';
import { Diff, hayCambios } from './calcular-diff';
import { entidadIdParPrefix } from './entidad-id';

// Filtros del log global (AuditService.listarGlobal). Ids crudos, sin
// resolver nombres — eso lo hace la pantalla (ver docs/decisiones/auditoria.md).
export interface FindAuditLogQuery {
  entidad?: string;
  actorRol?: RolUsuario;
  actorUsuarioId?: number;
  desde?: Date;
  hasta?: Date;
  page?: number;
  limit?: number;
}

// Escribe filas en AuditLog. El diff en sí lo calcula calcular-diff.ts
// (funciones puras, sin I/O); este service es la única pieza que toca Prisma.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // El PRIMER parámetro es el cliente TRANSACCIONAL — sin default a
  // this.prisma y sin marcarlo opcional, a propósito. El log tiene que
  // escribirse en la MISMA transacción que el cambio que audita: si esa
  // transacción se revierte, el log se tiene que revertir con ella. Un
  // default silencioso a this.prisma dejaría un call site escribir el log
  // por fuera de la transacción sin darse cuenta, y ahí quedaría un
  // AuditLog huérfano describiendo un cambio que nunca se aplicó. Hacerlo
  // obligatorio en la firma es lo que impide que eso pase.
  async registrar(
    tx: Prisma.TransactionClient,
    entrada: {
      entidad: string;
      entidadId: string;
      accion: 'CREATE' | 'UPDATE' | 'DELETE';
      diff: Diff;
      actor: string;
    } & Partial<ActorIdentidad>,
  ): Promise<void> {
    // Un UPDATE que no cambió ningún campo no es un evento: no hay nada que
    // reconstruir después, y escribirlo igual sólo ensucia el historial de
    // esa entidad con filas vacías. Mismo criterio para CREATE/DELETE (en la
    // práctica siempre traen al menos un campo, pero la regla es una sola:
    // sin diff, no se escribe).
    if (!hayCambios(entrada.diff)) return;

    await tx.auditLog.create({
      data: {
        entidad: entrada.entidad,
        entidadId: entrada.entidadId,
        accion: entrada.accion,
        diff: entrada.diff as Prisma.InputJsonValue,
        actor: entrada.actor,
        // Las cuatro son opcionales (Partial<ActorIdentidad>): un caller sin
        // IdentidadResuelta (import antes de sumarle @Actor(), seeds,
        // scripts) las deja undefined y Prisma las graba NULL — mismo
        // resultado que las filas de antes de esta columna.
        actorUsuarioId: entrada.actorUsuarioId,
        actorNombre: entrada.actorNombre,
        actorApellido: entrada.actorApellido,
        actorRol: entrada.actorRol,
      },
    });
  }

  // Historial de UNA persona: Vinculacion + sus pares VinculacionPuestoCentro.
  // El log no guarda usuarioId (guarda entidad + entidadId), así que primero
  // hay que resolver a qué Vinculacion pertenece antes de poder filtrar.
  //
  // Sin paginación en esta vuelta: el volumen por persona es de decenas de
  // filas, no cientos — límite conocido, no hace falta todavía.
  async listarPorUsuario(usuarioId: number): Promise<AuditLog[]> {
    // Sin filtrar por deletedAt, A PROPÓSITO — a diferencia del resto de la
    // API. El 404 acá es "esta persona nunca existió", no "está dada de
    // baja": el caso de uso central de este endpoint es ver el historial de
    // alguien que ya no está. No "arreglar" esto agregando deletedAt: null
    // más adelante para ser consistente con el resto — sería quitarle el
    // propósito al endpoint.
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId },
      select: { id: true },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);
    }

    // Mismo criterio para la Vinculacion: sin filtrar deletedAt.
    const vinculacion = await this.prisma.vinculacion.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!vinculacion) {
      // Cero vinculación es una cardinalidad válida — nada que auditar,
      // no es un error.
      return [];
    }

    // Los pares se resuelven por PREFIJO de entidadId, nunca leyendo
    // VinculacionPuestoCentro: esa tabla se borra FÍSICO cuando update()
    // reemplaza el set de pares, así que un par sacado no tiene fila que
    // leer — pero su CREATE y su DELETE siguen en el log, y es precisamente
    // el historial que interesa mostrar acá. El log es la única fuente de
    // verdad para esto, no un espejo de lo que hay hoy en la tabla.
    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entidad: 'Vinculacion', entidadId: String(vinculacion.id) },
          {
            entidad: 'VinculacionPuestoCentro',
            entidadId: { startsWith: entidadIdParPrefix(vinculacion.id) },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Log GLOBAL, transversal a todas las entidades — a diferencia de
  // listarPorUsuario(), acá sí hace falta paginar: no hay un límite natural
  // como "los pares de una persona", puede crecer a miles de filas.
  //
  // Devuelve ids crudos, sin resolver nombres (puestoId/moduloId/etc. tal
  // cual están en el diff) — la pantalla que lo consume ya tiene los
  // catálogos cargados para eso, mismo criterio que HistorialUsuario.jsx hoy.
  async listarGlobal(query: FindAuditLogQuery): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.entidad ? { entidad: query.entidad } : {}),
      ...(query.actorRol ? { actorRol: query.actorRol } : {}),
      ...(query.actorUsuarioId !== undefined
        ? { actorUsuarioId: query.actorUsuarioId }
        : {}),
      ...(query.desde || query.hasta
        ? {
            createdAt: {
              ...(query.desde ? { gte: query.desde } : {}),
              ...(query.hasta ? { lte: query.hasta } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
