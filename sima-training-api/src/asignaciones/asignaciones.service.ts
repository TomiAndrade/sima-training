import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAsignacionDto } from './dto/create-asignacion.dto';
import { calcularVencimiento } from './vigencia';

@Injectable()
export class AsignacionesService {
  constructor(private readonly prisma: PrismaService) {}

  // Lista las asignaciones de una persona (vigentes y revocadas), cada una con
  // su `vencimiento` (Story 8): { estado, aprobadaEn, venceEl }. Se calcula
  // para TODAS por igual, sin ramificar por `revocadaAt` — una revocada de un
  // módulo que la persona aprobó sigue teniendo un vencimiento real, y meter
  // un caso especial acá sería más confuso que el dato de más.
  //
  // `aprobacionesPorModulo` se pide UNA sola vez para toda la persona (no una
  // query por fila) y se cruza en memoria por moduloId. `ahora` se calcula
  // una sola vez fuera del `.map()` para que todas las filas de la misma
  // respuesta se evalúen contra el mismo instante.
  async findByUsuario(usuarioId: number) {
    const [asignaciones, aprobaciones] = await Promise.all([
      this.prisma.asignacion.findMany({
        where: { usuarioId },
        include: {
          modulo: { select: { id: true, nombre: true, vigenciaMeses: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.aprobacionesPorModulo(usuarioId),
    ]);

    const ahora = new Date();
    return asignaciones.map((asignacion) => {
      const aprobadaEn =
        aprobaciones.get(asignacion.moduloId)?.aprobadaEn ?? null;
      const { estado, venceEl } = calcularVencimiento(
        aprobadaEn,
        asignacion.modulo.vigenciaMeses,
        ahora,
      );
      return { ...asignacion, vencimiento: { estado, aprobadaEn, venceEl } };
    });
  }

  // Alta MANUAL (la carga un admin). recalcular() nunca las toca. El índice
  // único parcial (una vigente por usuario+módulo) rechaza duplicar una vigente.
  async createManual(dto: CreateAsignacionDto, actor = 'backoffice') {
    await this.assertUsuarioExiste(dto.usuarioId);
    const modulo = await this.prisma.modulo.findUnique({
      where: { id: dto.moduloId },
      select: { id: true },
    });
    if (!modulo) {
      throw new BadRequestException(`El módulo ${dto.moduloId} no existe`);
    }
    try {
      return await this.prisma.asignacion.create({
        data: {
          usuarioId: dto.usuarioId,
          moduloId: dto.moduloId,
          origen: 'MANUAL',
          createdBy: actor,
        },
      });
    } catch (err) {
      // P2002: choca con el índice único parcial → ya hay una vigente de ese
      // módulo para esa persona (sea MANUAL o AUTOMATICA).
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `El usuario ${dto.usuarioId} ya tiene una asignación vigente del módulo ${dto.moduloId}`,
        );
      }
      throw err;
    }
  }

  // Revoca una asignación (nunca se borra). Idempotente: revocar una ya revocada
  // no la cambia.
  async revocar(id: string, actor = 'backoffice') {
    const asignacion = await this.prisma.asignacion.findUnique({
      where: { id },
    });
    if (!asignacion) {
      throw new NotFoundException(`Asignación ${id} no encontrada`);
    }
    if (asignacion.revocadaAt) {
      return asignacion;
    }
    return this.prisma.asignacion.update({
      where: { id },
      data: { revocadaAt: new Date(), updatedBy: actor },
    });
  }

  // Recalcula las asignaciones AUTOMATICA de una persona a partir de sus pares
  // (puesto, centro) activos y las reglas vigentes. Wrapper que abre su propia
  // transacción y delega en recalcularEnTx. Es el punto de entrada del endpoint
  // standalone; para engancharse a una transacción ya abierta (p. ej. el ABM de
  // usuarios cuando reemplaza los pares) se llama recalcularEnTx con el `tx`.
  async recalcular(usuarioId: number, actor = 'backoffice') {
    return this.prisma.$transaction((tx) =>
      this.recalcularEnTx(tx, usuarioId, actor),
    );
  }

  // Igual que recalcular() pero sobre el cliente transaccional que provee el
  // caller, para correr en la MISMA transacción que cambió los pares: así el
  // recálculo ve los pares nuevos y, si algo falla, se revierte todo junto (no
  // quedan pares nuevos con asignaciones viejas). Síncrono e idempotente:
  //   - crea las AUTOMATICA que faltan (unión de los módulos que piden las reglas
  //     por par exacto Y las reglas de centro que le aplican),
  //   - revoca las AUTOMATICA que ya no corresponden a ningún par activo,
  //   - NUNCA toca las MANUAL.
  // Correrlo dos veces seguidas no crea duplicados ni revoca de más.
  async recalcularEnTx(
    tx: Prisma.TransactionClient,
    usuarioId: number,
    actor = 'backoffice',
  ) {
    await this.assertUsuarioExiste(usuarioId, tx);

    // 1. Pares (puesto, centro) ACTIVOS de la vinculación (no dada de baja).
    const pares = await tx.vinculacionPuestoCentro.findMany({
      where: {
        activo: true,
        vinculacion: { usuarioId, deletedAt: null },
      },
      select: { puestoId: true, centroCostoId: true },
    });

    // 2. Unión de módulos obligatorios: reglas activas que le aplican a la persona,
    //    por cualquiera de los dos alcances de ReglaAsignacion.
    //    Un módulo pedido por varias reglas aparece una sola vez (es un Set) → una
    //    sola asignación. Sin pares no hay nada requerido (evita un OR: []).
    const requeridos = new Set<string>();
    if (pares.length) {
      // Centros donde la persona tiene AL MENOS un par activo, sin importar el
      // puesto: es lo que habilita las reglas de centro.
      const centrosIds = [...new Set(pares.map((par) => par.centroCostoId))];

      const reglas = await tx.reglaAsignacion.findMany({
        where: {
          activo: true,
          // Los dos ejes de baja de una regla: `activo` es la pausa reversible,
          // deletedAt es la eliminación. Si este filtro falta, una regla eliminada
          // sigue generando asignaciones AUTOMATICA.
          deletedAt: null,
          // Las dos ramas son disjuntas en SQL: la primera genera `puesto_id = 'x'`
          // (que nunca matchea NULL) y la segunda `puesto_id IS NULL`. Ninguna regla
          // se lee dos veces — y si se leyera, el Set de abajo lo absorbe igual.
          OR: [
            // a) Reglas por PAR EXACTO: sólo quien ejerce ese puesto en ese centro.
            ...pares.map((par) => ({
              puestoId: par.puestoId,
              centroCostoId: par.centroCostoId,
            })),
            // b) Reglas de CENTRO (puestoId null): aplican a todos los puestos del
            //    centro. Alcanza con tener algún par activo ahí.
            { puestoId: null, centroCostoId: { in: centrosIds } },
          ],
        },
        select: { moduloId: true },
      });
      for (const regla of reglas) requeridos.add(regla.moduloId);
    }

    // 3. Módulos que la persona ya aprobó (ver modulosAprobados). Va por `tx`, no
    //    por this.prisma: cuando el recálculo corre embebido (el ABM de usuarios
    //    reemplazando pares, el de reglas) tiene que ver lo mismo que el resto de
    //    la transacción, no una foto de afuera.
    const aprobados = await this.modulosAprobados(usuarioId, tx);

    // 4. Asignaciones vigentes actuales.
    const vigentes = await tx.asignacion.findMany({
      where: { usuarioId, revocadaAt: null },
      select: { id: true, moduloId: true, origen: true },
    });
    const modulosCubiertos = new Set(vigentes.map((a) => a.moduloId));

    // 5. Crear: requeridos que no estén aprobados ni ya cubiertos por una
    //    vigente (de cualquier origen — no se duplica sobre una MANUAL).
    const aCrear = [...requeridos].filter(
      (moduloId) => !aprobados.has(moduloId) && !modulosCubiertos.has(moduloId),
    );

    // 6. Revocar: vigentes AUTOMATICA cuyo módulo ya no está requerido por
    //    ninguna regla vigente (ni por par ni de centro). Se usa `requeridos` (NO
    //    `requeridos − aprobados`): un módulo aprobado que una regla sigue pidiendo
    //    no se revoca; sólo no se re-crea. Las MANUAL nunca entran acá.
    //    Sacarle a alguien el último par de un centro saca ese centro de
    //    `centrosIds`, la regla de centro deja de aportar su módulo y la asignación
    //    se revoca sola — sin lógica extra acá.
    const aRevocar = vigentes.filter(
      (a) => a.origen === 'AUTOMATICA' && !requeridos.has(a.moduloId),
    );

    if (!aCrear.length && !aRevocar.length) {
      return { creadas: 0, revocadas: 0 };
    }

    const ahora = new Date();
    if (aCrear.length) {
      await tx.asignacion.createMany({
        data: aCrear.map((moduloId) => ({
          usuarioId,
          moduloId,
          origen: 'AUTOMATICA' as const,
          createdBy: actor,
        })),
      });
    }
    if (aRevocar.length) {
      await tx.asignacion.updateMany({
        where: { id: { in: aRevocar.map((a) => a.id) } },
        data: { revocadaAt: ahora, updatedBy: actor },
      });
    }

    return { creadas: aCrear.length, revocadas: aRevocar.length };
  }

  // Última aprobación de cada módulo, con la vigencia (Modulo.vigenciaMeses)
  // que regía en el momento de leerla — el insumo crudo que calcularVencimiento()
  // necesita, sin decidir todavía qué está cubierto. Separado de
  // modulosAprobados() porque es lo que Story 10 (informe de aprobaciones)
  // va a necesitar sin el filtro de vigencia.
  //
  // Una sola query, agrupada en JS quedándose con el createdAt más reciente
  // por moduloId. NO se usa groupBy ni SQL crudo: el volumen de sesiones
  // aprobadas por persona es de decenas de filas, así que agrupar en memoria
  // mantiene el método usable dentro de una transacción sin sumar otra query.
  async aprobacionesPorModulo(
    usuarioId: number,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Map<string, { aprobadaEn: Date; vigenciaMeses: number | null }>> {
    const sesiones = await client.sesion.findMany({
      where: { usuarioId, aprobada: true },
      select: {
        createdAt: true,
        moduloVersion: {
          select: {
            moduloId: true,
            modulo: { select: { vigenciaMeses: true } },
          },
        },
      },
    });

    const porModulo = new Map<
      string,
      { aprobadaEn: Date; vigenciaMeses: number | null }
    >();
    for (const sesion of sesiones) {
      const moduloId = sesion.moduloVersion.moduloId;
      const actual = porModulo.get(moduloId);
      // createdAt (reloj de SERVIDOR) y no finalizadaEn (reloj del
      // DISPOSITIVO, ver el comentario de Sesion en el schema): la fecha
      // oficial de una aprobación no puede depender de un reloj que la app
      // no controla.
      //
      // La MÁS RECIENTE y no la primera: volver a rendir y aprobar de nuevo
      // reinicia el reloj de la vigencia, no lo conserva desde la primera vez.
      if (!actual || sesion.createdAt > actual.aprobadaEn) {
        porModulo.set(moduloId, {
          aprobadaEn: sesion.createdAt,
          vigenciaMeses: sesion.moduloVersion.modulo.vigenciaMeses,
        });
      }
    }
    return porModulo;
  }

  // Módulos CUBIERTOS por una aprobación HOY — ya no significa "aprobó
  // alguna vez", significa "aprobó y esa aprobación TODAVÍA VALE" (Story 8:
  // la vigencia caduca la cobertura, ver vigencia.ts). El Set es una foto
  // del momento en que se llama, no el historial: para "¿aprobó este módulo
  // alguna vez, aunque hoy esté vencido?" (el informe de usuario de la
  // Story 10) hace falta otra consulta — este método NO sirve para eso,
  // sólo para decidir si hoy sigue habiendo o no una obligación de rendir.
  //
  // Consecuencia sobre recalcular(): deja de ser determinista respecto de la
  // base sola. La MISMA base, consultada en dos fechas distintas, puede dar
  // un resultado distinto (una aprobación que hoy cubre puede vencer mañana
  // sin que nada más haya cambiado). Sigue siendo idempotente en el sentido
  // que importa: correrlo dos veces seguidas EN LA MISMA fecha no duplica ni
  // revoca de más.
  //
  // Se entra por moduloVersionId y se sale por moduloId: la obligación es
  // "este módulo", así que aprobar CUALQUIER versión lo cubre (mientras esa
  // aprobación no esté vencida).
  //
  // Lo consume recalcular() en el paso de creación (una aprobación vencida
  // deja de tapar la creación — se beneficia solo, el paso de revocación no
  // cambia) y TabletService.pendientes() (excluir de la lista lo cubierto
  // hoy). Público por eso — misma lógica y misma firma de `client`. Ojo con
  // el `client`: el default es this.prisma para el uso suelto, pero
  // recalcularEnTx le pasa SIEMPRE su `tx`.
  //
  // `ahora` es sólo para poder testear sin fake timers — nadie en producción
  // lo pasa.
  async modulosAprobados(
    usuarioId: number,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
    ahora: Date = new Date(),
  ): Promise<Set<string>> {
    const aprobaciones = await this.aprobacionesPorModulo(usuarioId, client);

    const cubiertos = new Set<string>();
    for (const [moduloId, { aprobadaEn, vigenciaMeses }] of aprobaciones) {
      // POR_VENCER cuenta como cubierto: todavía vale, es sólo el aviso
      // previo. Únicamente VENCIDO deja de tapar la obligación.
      const { estado } = calcularVencimiento(aprobadaEn, vigenciaMeses, ahora);
      if (estado !== 'VENCIDO') cubiertos.add(moduloId);
    }
    return cubiertos;
  }

  private async assertUsuarioExiste(
    usuarioId: number,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const usuario = await client.usuario.findFirst({
      where: { id: usuarioId, deletedAt: null },
      select: { id: true },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);
    }
  }
}
