import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calcularVencimiento } from '../asignaciones/vigencia';
import {
  calcularVeredicto,
  EstadoVeredicto,
} from '../asignaciones/veredicto';

// Cuántas rendiciones lista "Últimas evaluaciones". Fijo y chico a propósito:
// es un vistazo de actividad reciente, no un listado paginado.
const RECIENTES = 7;

export interface ResumenSimaCheck {
  habilitacion: Record<EstadoVeredicto, number> & { total: number };
  aprobacion: { sesiones: number; aprobadas: number; porcentaje: number | null };
  porModulo: {
    moduloId: string;
    moduloNombre: string;
    sesiones: number;
    aprobadas: number;
    porcentaje: number;
  }[];
  recientes: {
    id: string;
    usuarioNombre: string;
    moduloNombre: string;
    porcentaje: number;
    aprobada: boolean;
    fecha: Date;
  }[];
}

const porcentaje = (parte: number, total: number) =>
  total === 0 ? 0 : Math.round((parte / total) * 100);

/**
 * Agregados de SIMA CHECK para la pantalla Resumen.
 *
 * Es un **agregador**, al estilo de `UsuariosService.informe()`: no tiene
 * entidad propia ni escribe nada, cruza `Asignacion` + `Sesion` + `Usuario`
 * para responder de un vistazo *"¿cuánta de mi gente está habilitada hoy?"*.
 * Vive en su módulo porque no le pertenece a ninguno de los tres dominios que
 * consume.
 *
 * **Reusa `calcularVencimiento` y `calcularVeredicto`, no los reimplementa.**
 * Es la misma respuesta que da `GET /usuarios/:id/informe` por persona, sumada
 * sobre toda la nómina — si divergieran, el dashboard diría una cosa y la hoja
 * de vida de esa misma persona diría otra.
 *
 * **No cachea, a propósito.** Con la nómina real (264 personas) son dos queries
 * que Postgres resuelve en milisegundos; cachear agregaría datos viejos para
 * ahorrar algo que no cuesta. Si algún día pesa, el techo está identificado y
 * documentado abajo, no hay que ir a buscarlo.
 */
@Injectable()
export class ResumenService {
  constructor(private readonly prisma: PrismaService) {}

  async simaCheck(): Promise<ResumenSimaCheck> {
    // `ahora` se calcula UNA vez y se pasa a todos los cálculos de vencimiento:
    // si cada fila usara su propio instante, dos asignaciones al borde del
    // vencimiento podrían caer de lados distintos dentro de la misma respuesta.
    const ahora = new Date();

    const [asignaciones, aprobadas, totalUsuarios, sesiones, recientes] =
      await Promise.all([
        // Sólo las vigentes: una revocada ya no le corresponde a la persona.
        // calcularVeredicto igual filtra por revocadaAt, pero traerlas sería
        // mover filas al pedo desde la base.
        this.prisma.asignacion.findMany({
          where: { revocadaAt: null },
          select: {
            id: true,
            usuarioId: true,
            moduloId: true,
            revocadaAt: true,
            modulo: { select: { nombre: true, vigenciaMeses: true } },
          },
        }),

        // Todas las sesiones aprobadas, agrupadas después en memoria por
        // (usuario, módulo). **Dos queries en total, no dos por persona**: la
        // versión por-usuario de esto (`AsignacionesService.findByUsuario`)
        // haría 528 queries para 264 personas.
        //
        // ⚠️ TECHO CONOCIDO: esto trae todas las sesiones aprobadas de la
        // historia. Con la nómina real son miles de filas y entra cómodo en
        // memoria; con un par de órdenes de magnitud más habría que pasarlo a
        // un `DISTINCT ON (usuario, modulo) ... ORDER BY created_at DESC` en
        // SQL crudo. Se eligió agrupar en JS por coherencia con
        // `aprobacionesPorModulo`, que ya resuelve lo mismo así.
        this.prisma.sesion.findMany({
          where: { aprobada: true },
          select: {
            usuarioId: true,
            createdAt: true,
            moduloVersion: { select: { moduloId: true } },
          },
        }),

        // Para contar SIN_OBLIGACIONES: son los usuarios vivos que no aparecen
        // en `asignaciones`. No se puede derivar de las asignaciones solas —
        // justamente lo que los define es no tener ninguna.
        this.prisma.usuario.count({ where: { deletedAt: null } }),

        this.prisma.sesion.groupBy({
          by: ['aprobada'],
          _count: { _all: true },
        }),

        this.prisma.sesion.findMany({
          orderBy: { createdAt: 'desc' },
          take: RECIENTES,
          select: {
            id: true,
            porcentaje: true,
            aprobada: true,
            createdAt: true,
            usuario: { select: { nombre: true, apellido: true } },
            moduloVersion: { select: { modulo: { select: { nombre: true } } } },
          },
        }),
      ]);

    return {
      habilitacion: this.contarHabilitacion(
        asignaciones,
        aprobadas,
        totalUsuarios,
        ahora,
      ),
      aprobacion: this.contarAprobacion(sesiones),
      porModulo: await this.aprobacionPorModulo(),
      recientes: recientes.map((s) => ({
        id: s.id,
        usuarioNombre: `${s.usuario.nombre} ${s.usuario.apellido}`,
        moduloNombre: s.moduloVersion.modulo.nombre,
        porcentaje: s.porcentaje,
        aprobada: s.aprobada,
        fecha: s.createdAt,
      })),
    };
  }

  // Última aprobación de cada (usuario, módulo). Espeja el criterio de
  // `AsignacionesService.aprobacionesPorModulo`: la MÁS RECIENTE (volver a
  // aprobar reinicia el reloj de la vigencia) y por `createdAt`, que es reloj
  // de servidor — `finalizadaEn` es el reloj del dispositivo.
  private ultimaAprobacion(
    aprobadas: {
      usuarioId: number;
      createdAt: Date;
      moduloVersion: { moduloId: string };
    }[],
  ): Map<string, Date> {
    const porClave = new Map<string, Date>();
    for (const s of aprobadas) {
      const clave = `${s.usuarioId}::${s.moduloVersion.moduloId}`;
      const actual = porClave.get(clave);
      if (!actual || s.createdAt > actual) porClave.set(clave, s.createdAt);
    }
    return porClave;
  }

  private contarHabilitacion(
    asignaciones: {
      id: string;
      usuarioId: number;
      moduloId: string;
      revocadaAt: Date | null;
      modulo: { nombre: string; vigenciaMeses: number | null };
    }[],
    aprobadas: {
      usuarioId: number;
      createdAt: Date;
      moduloVersion: { moduloId: string };
    }[],
    totalUsuarios: number,
    ahora: Date,
  ): Record<EstadoVeredicto, number> & { total: number } {
    const aprobacion = this.ultimaAprobacion(aprobadas);

    const porUsuario = new Map<
      number,
      Parameters<typeof calcularVeredicto>[0]
    >();
    for (const a of asignaciones) {
      const aprobadaEn = aprobacion.get(`${a.usuarioId}::${a.moduloId}`) ?? null;
      const { estado } = calcularVencimiento(
        aprobadaEn,
        a.modulo.vigenciaMeses,
        ahora,
      );
      const lista = porUsuario.get(a.usuarioId) ?? [];
      lista.push({
        id: a.id,
        moduloNombre: a.modulo.nombre,
        revocadaAt: a.revocadaAt,
        vencimiento: { estado },
      });
      porUsuario.set(a.usuarioId, lista);
    }

    const conteo: Record<EstadoVeredicto, number> = {
      NO_HABILITADO: 0,
      PENDIENTE: 0,
      POR_VENCER: 0,
      EN_REGLA: 0,
      SIN_OBLIGACIONES: 0,
    };
    for (const lista of porUsuario.values()) {
      conteo[calcularVeredicto(lista).estado]++;
    }

    // Los que no aparecieron en ninguna asignación vigente. Se derivan por
    // resta en vez de traer la lista completa de usuarios: lo único que hace
    // falta de ellos es cuántos son.
    conteo.SIN_OBLIGACIONES += Math.max(0, totalUsuarios - porUsuario.size);

    return { ...conteo, total: totalUsuarios };
  }

  private contarAprobacion(
    sesiones: { aprobada: boolean; _count: { _all: number } }[],
  ) {
    const aprobadas =
      sesiones.find((s) => s.aprobada)?._count._all ?? 0;
    const total = sesiones.reduce((acc, s) => acc + s._count._all, 0);
    return {
      sesiones: total,
      aprobadas,
      // `null` y no `0` cuando todavía nadie rindió: 0% se lee como "rinden y
      // desaprueban todos", que es una lectura muy distinta de "no hay datos".
      porcentaje: total === 0 ? null : porcentaje(aprobadas, total),
    };
  }

  // Aprobación por módulo, para el gráfico. Agrupa por `moduloVersionId` y
  // colapsa a módulo en memoria: el gráfico compara MÓDULOS, y las versiones de
  // un mismo módulo son el mismo contenido evolucionando — separarlas partiría
  // cada barra en varias sin que eso signifique nada para quien mira.
  private async aprobacionPorModulo() {
    const [porVersion, versiones] = await Promise.all([
      this.prisma.sesion.groupBy({
        by: ['moduloVersionId', 'aprobada'],
        _count: { _all: true },
      }),
      this.prisma.moduloVersion.findMany({
        select: { id: true, moduloId: true, modulo: { select: { nombre: true } } },
      }),
    ]);

    const moduloDeVersion = new Map(
      versiones.map((v) => [
        v.id,
        { moduloId: v.moduloId, nombre: v.modulo.nombre },
      ]),
    );

    const acc = new Map<
      string,
      { moduloNombre: string; sesiones: number; aprobadas: number }
    >();
    for (const fila of porVersion) {
      const mod = moduloDeVersion.get(fila.moduloVersionId);
      if (!mod) continue;
      const actual = acc.get(mod.moduloId) ?? {
        moduloNombre: mod.nombre,
        sesiones: 0,
        aprobadas: 0,
      };
      actual.sesiones += fila._count._all;
      if (fila.aprobada) actual.aprobadas += fila._count._all;
      acc.set(mod.moduloId, actual);
    }

    return [...acc.entries()]
      .map(([moduloId, v]) => ({
        moduloId,
        ...v,
        porcentaje: porcentaje(v.aprobadas, v.sesiones),
      }))
      // Por nombre y no por porcentaje: el gráfico se lee comparando barras, y
      // que cambien de lugar entre dos cargas lo vuelve ilegible.
      .sort((a, b) => a.moduloNombre.localeCompare(b.moduloNombre, 'es'));
  }
}
