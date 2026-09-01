import { Injectable } from '@nestjs/common';
import { normalizar } from '../import/similitud';
import { PrismaService } from '../prisma/prisma.service';

export interface PruebaInvitado {
  sesionId: string;
  nombre: string;
  moduloNombre: string;
  correctas: number;
  total: number;
  porcentaje: number;
  aprobada: boolean;
  // Reloj del SERVIDOR (`createdAt`), no el del dispositivo — mismo criterio
  // con el que el historial de rendiciones reales muestra la fecha.
  fecha: Date;
}

export interface InvitadosPorModulo {
  moduloId: string;
  moduloNombre: string;
  pruebas: number;
  aprobadas: number;
  porcentajeAprobacion: number;
}

export interface EstadisticasInvitados {
  totales: {
    pruebas: number;
    // Nombres DISTINTOS, normalizados. Es una aproximación, no un conteo de
    // personas — ver el comentario de `normalizar()`.
    nombres: number;
    aprobadas: number;
    // `null` y no `0` cuando todavía no probó nadie: 0 % se lee como "prueban
    // todos y desaprueban todos". Mismo criterio que ResumenService y
    // EstadisticasService.
    porcentajeAprobacion: number | null;
    respuestas: number;
    correctas: number;
    porcentajeAcierto: number | null;
  };
  porModulo: InvitadosPorModulo[];
  // Las últimas pruebas, más reciente primero. Es el "historial" del modo: con
  // quién probó, qué módulo y cómo le fue.
  recientes: PruebaInvitado[];
}

// Cuántas pruebas devuelve el historial. Bastante más que las 7 de
// `ResumenService.recientes` porque acá la lista ES el reporte y no un bloque de
// contexto: la pregunta que se le hace a esta pantalla es literalmente "quién lo
// probó". No pagina — con paginación habría que decidir un orden estable y un
// cursor para algo que se mira de a una pantalla.
const MAXIMO_RECIENTES = 50;

const pct = (parte: number, total: number) =>
  total === 0 ? null : Math.round((parte / total) * 100);

/**
 * Cómo le fue al MODO INVITADO: cuánta gente probó la app y con qué resultado.
 *
 * Service aparte de `EstadisticasService` y no un método más, aunque cuelguen
 * del mismo controller: no comparten una sola query. `EstadisticasService` mide
 * el contenido contra la nómina real (`Respuesta` → `Pregunta` → base, cortes
 * por puesto y centro de costo); esto lee `SesionInvitado`, que no tiene nada de
 * eso — un invitado no tiene puesto, ni centro, ni obligaciones, ni vencimientos.
 *
 * Esa separación es la contracara de que las tablas estén separadas: los números
 * de la demo no pueden colarse en los de la nómina porque no salen de las mismas
 * filas, y no porque alguien se acuerde de filtrar.
 *
 * **Una sola query y agregación en memoria**, a diferencia de los seis `groupBy`
 * de `EstadisticasService`. Es una decisión de tamaño, no de estilo: las
 * rendiciones de demo se cuentan de a decenas (una o dos tablets en una oficina),
 * así que traerlas y agruparlas en JS es más simple de leer y de mantener que
 * cuatro `groupBy` con sus mapas. Si algún día la demo se usa a escala —una
 * feria, un cliente evaluando— esto pasa a `groupBy` sin cambiar el contrato.
 */
@Injectable()
export class InvitadosService {
  constructor(private readonly prisma: PrismaService) {}

  async estadisticas(): Promise<EstadisticasInvitados> {
    const sesiones = await this.prisma.sesionInvitado.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nombre: true,
        correctas: true,
        total: true,
        porcentaje: true,
        aprobada: true,
        createdAt: true,
        moduloVersion: {
          select: {
            moduloId: true,
            modulo: { select: { nombre: true } },
          },
        },
      },
    });

    const aprobadas = sesiones.filter((s) => s.aprobada).length;
    const respuestas = sesiones.reduce((acc, s) => acc + s.total, 0);
    const correctas = sesiones.reduce((acc, s) => acc + s.correctas, 0);
    // `normalizar()` es el mismo de import/similitud.ts (minúsculas, sin
    // acentos, espacios colapsados): "Juan", "juan " y "JUAN  Pérez" no cuentan
    // como tres. Se reusa en vez de escribir otra copia — es una función pura
    // sin dependencias, mismo precedente que asignaciones/vigencia.ts en
    // resumen/.
    //
    // ⚠️ Sigue siendo una APROXIMACIÓN, y la pantalla tiene que decirlo: el
    // nombre de un invitado no es una identidad verificada. Dos personas
    // distintas llamadas igual cuentan como una, y la misma persona
    // escribiéndose distinto ("Juan" y "Juan Pérez") cuenta como dos. Sirve
    // para "más o menos cuánta gente pasó por acá", no para un padrón.
    const nombres = new Set(sesiones.map((s) => normalizar(s.nombre)));

    return {
      totales: {
        pruebas: sesiones.length,
        nombres: nombres.size,
        aprobadas,
        porcentajeAprobacion: pct(aprobadas, sesiones.length),
        respuestas,
        correctas,
        porcentajeAcierto: pct(correctas, respuestas),
      },
      porModulo: this.agruparPorModulo(sesiones),
      recientes: sesiones.slice(0, MAXIMO_RECIENTES).map((s) => ({
        sesionId: s.id,
        nombre: s.nombre,
        moduloNombre: s.moduloVersion.modulo.nombre,
        correctas: s.correctas,
        total: s.total,
        porcentaje: s.porcentaje,
        aprobada: s.aprobada,
        fecha: s.createdAt,
      })),
    };
  }

  // Colapsa las versiones de un mismo módulo en una sola fila, igual que
  // `ResumenService.aprobacionPorModulo`: al que mira el reporte le interesa
  // "cuánta gente probó Reglas de Oro", no cómo se reparte entre la 2026.01.00 y
  // la 2026.01.01.
  private agruparPorModulo(
    sesiones: {
      aprobada: boolean;
      moduloVersion: { moduloId: string; modulo: { nombre: string } };
    }[],
  ): InvitadosPorModulo[] {
    const acc = new Map<string, InvitadosPorModulo>();

    for (const sesion of sesiones) {
      const { moduloId, modulo } = sesion.moduloVersion;
      const fila = acc.get(moduloId) ?? {
        moduloId,
        moduloNombre: modulo.nombre,
        pruebas: 0,
        aprobadas: 0,
        porcentajeAprobacion: 0,
      };
      fila.pruebas += 1;
      if (sesion.aprobada) fila.aprobadas += 1;
      acc.set(moduloId, fila);
    }

    return [...acc.values()]
      .map((f) => ({
        ...f,
        // Acá sí 0 y no null: una fila de este array existe sólo si tuvo al
        // menos una prueba, así que el divisor nunca es cero y "0 %" significa
        // de verdad que nadie aprobó.
        porcentajeAprobacion: Math.round((f.aprobadas / f.pruebas) * 100),
      }))
      // Por nombre y no por cantidad, mismo criterio que el gráfico del
      // Resumen: las filas no cambian de lugar entre dos cargas.
      .sort((a, b) => a.moduloNombre.localeCompare(b.moduloNombre, 'es'));
  }
}

