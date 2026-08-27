import { Injectable } from '@nestjs/common';
import { Prisma, TipoPregunta } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Cuántas respuestas necesita una pregunta para que su porcentaje signifique
 * algo. Una pregunta contestada una sola vez y fallada da 0 % de acierto, y eso
 * no dice nada sobre la pregunta — dice que la contestó una persona.
 *
 * Se exporta porque el backoffice lo necesita para dos cosas: pintar en gris las
 * filas del ranking que no llegan al mínimo, y decidir qué entra en "sin ningún
 * fallo". Que el número viva acá y no duplicado en el frontend es lo que evita
 * que las dos pantallas discrepen sobre cuál es el umbral.
 */
export const MINIMO_SIGNIFICATIVO = 5;

// Las dos opciones de VERDADERO_FALSO NO están en el jsonb `opciones` (viene
// vacío): las pone el frontend. Son estos dos strings exactos, que es contra lo
// que corrige `sesiones/corregir.ts`. Sin esto, toda respuesta a una V/F saldría
// marcada como `entreOpciones: false`, o sea "eligió algo que no estaba".
const OPCIONES_VERDADERO_FALSO = ['Verdadero', 'Falso'];

export interface DistribucionOpcion {
  // null = no contestó. Es un estado real (`Respuesta.respuestaDada` es
  // nullable) y se lista como uno más, no se descarta.
  valor: string | null;
  veces: number;
  esCorrecta: boolean;
  // false = el string no figura entre las opciones actuales de la pregunta.
  // Hoy no debería pasar (las preguntas no se editan), pero si pasa se muestra
  // igual en vez de desaparecer del total y dejar la distribución sin cerrar.
  entreOpciones: boolean;
}

export interface EstadisticaPregunta {
  preguntaId: string;
  texto: string;
  tipo: TipoPregunta;
  activa: boolean;
  base: { id: string; nombre: string } | null;
  nivel: { id: string; nombre: string } | null;
  respuestas: number;
  correctas: number;
  incorrectas: number;
  porcentajeAcierto: number | null;
  // Está en alguna ModuloVersion ACTIVO con el pivot activo, o sea que el
  // sorteo de la tablet puede servirla hoy. Es lo que separa "nunca salió
  // sorteada" (dato accionable: el pool está desbalanceado) de "no está en
  // ningún módulo" (que ya se ve en la pantalla Preguntas con ?sinAsignar=true).
  enPoolActivo: boolean;
  distribucion: DistribucionOpcion[];
}

export interface EstadisticaNivel {
  nivelId: string | null;
  nivelNombre: string;
  respuestas: number;
  correctas: number;
  porcentaje: number;
}

export interface EstadisticaBase {
  baseId: string | null;
  baseNombre: string;
  respuestas: number;
  correctas: number;
  porcentaje: number;
  niveles: EstadisticaNivel[];
}

export interface EstadisticaCatalogo {
  id: string;
  nombre: string;
  personas: number;
  sesiones: number;
  respuestas: number;
  correctas: number;
  porcentaje: number;
}

export interface EstadisticasSimaCheck {
  totales: {
    sesiones: number;
    respuestas: number;
    correctas: number;
    porcentaje: number | null;
    preguntasConDatos: number;
    preguntasEnPoolSinDatos: number;
  };
  preguntas: EstadisticaPregunta[];
  porBase: EstadisticaBase[];
  porCentroCosto: EstadisticaCatalogo[];
  porPuesto: EstadisticaCatalogo[];
}

// `null` y no `0` cuando no hay nada medido: 0 % se lee como "contestan y
// fallan todos", que es una lectura muy distinta de "no hay datos". Mismo
// criterio que `ResumenService.contarAprobacion`.
const pct = (parte: number, total: number) =>
  total === 0 ? null : Math.round((parte / total) * 100);

const SIN_CLASIFICAR = 'Sin clasificar';
const SIN_NIVEL = 'Sin nivel';

interface Conteo {
  respuestas: number;
  correctas: number;
}

const sumar = (acc: Conteo, respuestas: number, correctas: number) => {
  acc.respuestas += respuestas;
  acc.correctas += correctas;
};

/**
 * Estadísticas de contenido de SIMA CHECK: qué preguntas se fallan, qué temas
 * hay que reforzar y dónde.
 *
 * Es un **agregador**, mismo rol que `ResumenService`: no tiene entidad propia,
 * no escribe nada y consume Prisma directo en vez de los services de cada
 * dominio (que son todos por-usuario y harían N+1).
 *
 * **Módulo aparte de `resumen/` a propósito**: el Resumen responde *"¿cuánta de
 * mi gente está habilitada hoy?"* y esto responde *"¿qué contenido está
 * fallando?"*. Son dos preguntas distintas con dos consumidores distintos, y
 * mezclarlas convertiría un endpoint en un cajón de sastre.
 *
 * **El payload NO incluye `respuestaCorrecta` en ningún lado**, y por eso el
 * endpoint puede quedar abierto como el resto de los GET. La distribución dice
 * cuántos eligieron cada opción y cuál de esas entradas era la buena
 * (`esCorrecta`), que es la información que hace falta para revisar una
 * distractora — sin entregar el string de la correcta a quien no rindió todavía.
 * Si alguna vez se agrega ese campo acá, este endpoint pasa a necesitar guard
 * como `GET /sesiones/:id`.
 *
 * **No cachea**, mismo criterio que `ResumenService`: son seis queries que
 * Postgres resuelve con los índices que ya existen (`Respuesta` tiene
 * `@@index([preguntaId])` puesto justamente para esto).
 */
@Injectable()
export class EstadisticasService {
  constructor(private readonly prisma: PrismaService) {}

  async simaCheck(): Promise<EstadisticasSimaCheck> {
    const [aciertos, opciones, preguntas, pool, porUsuario, pares] =
      await Promise.all([
        // (1) Alimenta el ranking Y el corte por base: con el mapa
        // preguntaId → {base, nivel} de la query (3), agrupar por tema es
        // memoria, no otra query contra la base.
        this.prisma.respuesta.groupBy({
          by: ['preguntaId', 'correcta'],
          _count: { _all: true },
        }),

        // (2) La distribución: cuántos eligieron cada opción. Es lo que
        // distingue una pregunta difícil (se falla, pero los errores se
        // reparten) de una mal armada (todos eligen la misma incorrecta).
        this.prisma.respuesta.groupBy({
          by: ['preguntaId', 'respuestaDada'],
          _count: { _all: true },
        }),

        this.prisma.pregunta.findMany({
          select: {
            id: true,
            texto: true,
            tipo: true,
            activa: true,
            opciones: true,
            respuestaCorrecta: true,
            base: { select: { id: true, nombre: true } },
            nivel: { select: { id: true, nombre: true, orden: true } },
          },
        }),

        // (3) El pool vivo: qué preguntas puede servir hoy el sorteo.
        this.prisma.moduloVersionPregunta.findMany({
          where: { activa: true, moduloVersion: { estado: 'ACTIVO' } },
          select: { preguntaId: true },
        }),

        // (4) Los cortes por centro y puesto salen de `Sesion.correctas`/`total`
        // y NO de `Respuesta`: da exactamente el mismo porcentaje de acierto y
        // evita joinear todas las respuestas contra la vinculación de cada
        // persona.
        this.prisma.sesion.groupBy({
          by: ['usuarioId'],
          _sum: { correctas: true, total: true },
          _count: { _all: true },
        }),

        // (5) Sólo pares ACTIVOS, mismo criterio con el que `/usuarios` filtra
        // por ?puestoId=: un par desactivado no describe dónde trabaja hoy.
        this.prisma.vinculacionPuestoCentro.findMany({
          where: { activo: true },
          select: {
            puestoId: true,
            centroCostoId: true,
            puesto: { select: { nombre: true } },
            centroCosto: { select: { nombre: true } },
            vinculacion: { select: { usuarioId: true } },
          },
        }),
      ]);

    const conteoPorPregunta = this.contarPorPregunta(aciertos);
    const distribucionPorPregunta = this.agruparDistribucion(opciones);
    const enPool = new Set(pool.map((p) => p.preguntaId));

    const filas = this.armarFilas(
      preguntas,
      conteoPorPregunta,
      distribucionPorPregunta,
      enPool,
    );

    const respuestas = filas.reduce((acc, f) => acc + f.respuestas, 0);
    const correctas = filas.reduce((acc, f) => acc + f.correctas, 0);
    const sesiones = porUsuario.reduce((acc, u) => acc + u._count._all, 0);

    return {
      totales: {
        sesiones,
        respuestas,
        correctas,
        porcentaje: pct(correctas, respuestas),
        preguntasConDatos: filas.filter((f) => f.respuestas > 0).length,
        preguntasEnPoolSinDatos: filas.filter(
          (f) => f.respuestas === 0 && f.enPoolActivo,
        ).length,
      },
      preguntas: filas,
      porBase: this.agruparPorBase(preguntas, conteoPorPregunta),
      ...this.agruparPorCatalogo(porUsuario, pares),
    };
  }

  private contarPorPregunta(
    aciertos: {
      preguntaId: string;
      correcta: boolean;
      _count: { _all: number };
    }[],
  ): Map<string, Conteo> {
    const mapa = new Map<string, Conteo>();
    for (const fila of aciertos) {
      const actual = mapa.get(fila.preguntaId) ?? { respuestas: 0, correctas: 0 };
      actual.respuestas += fila._count._all;
      if (fila.correcta) actual.correctas += fila._count._all;
      mapa.set(fila.preguntaId, actual);
    }
    return mapa;
  }

  private agruparDistribucion(
    opciones: {
      preguntaId: string;
      respuestaDada: string | null;
      _count: { _all: number };
    }[],
  ): Map<string, { valor: string | null; veces: number }[]> {
    const mapa = new Map<string, { valor: string | null; veces: number }[]>();
    for (const fila of opciones) {
      const lista = mapa.get(fila.preguntaId) ?? [];
      lista.push({ valor: fila.respuestaDada, veces: fila._count._all });
      mapa.set(fila.preguntaId, lista);
    }
    return mapa;
  }

  // Las opciones válidas de una pregunta, para decidir `entreOpciones`. En
  // OPCIONES_IMAGEN el jsonb guarda CLAVES de storage, que es exactamente lo
  // que `respuestaDada` trae de vuelta — se comparan crudas, sin armar URLs.
  private opcionesDe(pregunta: {
    tipo: TipoPregunta;
    opciones: Prisma.JsonValue;
  }): string[] {
    if (pregunta.tipo === TipoPregunta.VERDADERO_FALSO) {
      return OPCIONES_VERDADERO_FALSO;
    }
    return Array.isArray(pregunta.opciones)
      ? pregunta.opciones.filter((o): o is string => typeof o === 'string')
      : [];
  }

  private armarFilas(
    preguntas: {
      id: string;
      texto: string;
      tipo: TipoPregunta;
      activa: boolean;
      opciones: Prisma.JsonValue;
      respuestaCorrecta: string | null;
      base: { id: string; nombre: string } | null;
      nivel: { id: string; nombre: string; orden: number } | null;
    }[],
    conteo: Map<string, Conteo>,
    distribucion: Map<string, { valor: string | null; veces: number }[]>,
    enPool: Set<string>,
  ): EstadisticaPregunta[] {
    return preguntas
      // Sólo las que aportan algo: tienen respuestas, o el sorteo puede
      // servirlas. Una pregunta sin datos y fuera de todo módulo activo no es
      // un hallazgo de este reporte — eso ya lo responde ?sinAsignar=true en la
      // pantalla Preguntas.
      .filter((p) => conteo.has(p.id) || enPool.has(p.id))
      .map((p) => {
        const { respuestas, correctas } = conteo.get(p.id) ?? {
          respuestas: 0,
          correctas: 0,
        };
        const validas = this.opcionesDe(p);
        return {
          preguntaId: p.id,
          texto: p.texto,
          tipo: p.tipo,
          activa: p.activa,
          base: p.base,
          nivel: p.nivel ? { id: p.nivel.id, nombre: p.nivel.nombre } : null,
          respuestas,
          correctas,
          incorrectas: respuestas - correctas,
          porcentajeAcierto: pct(correctas, respuestas),
          enPoolActivo: enPool.has(p.id),
          distribucion: (distribucion.get(p.id) ?? [])
            .map((d) => ({
              valor: d.valor,
              veces: d.veces,
              esCorrecta:
                d.valor !== null && d.valor === p.respuestaCorrecta,
              entreOpciones: d.valor !== null && validas.includes(d.valor),
            }))
            .sort((a, b) => b.veces - a.veces),
        };
      })
      // Por cantidad de ERRORES y no por porcentaje: es la pregunta que se
      // quiso responder ("las que más se fallan"), y de paso evita que una
      // pregunta contestada una sola vez encabece el ranking con su 0 %.
      // Determinístico hasta el final (desempate por texto) para que el orden
      // no cambie entre dos cargas, mismo criterio que `aprobacionPorModulo`.
      .sort(
        (a, b) =>
          b.incorrectas - a.incorrectas ||
          b.respuestas - a.respuestas ||
          a.texto.localeCompare(b.texto, 'es'),
      );
  }

  // % de acierto por tema. Es el reporte que pidió HSE ("qué bases hay que
  // reforzar") y sale por join Respuesta → Pregunta → BaseConocimiento, sin
  // columnas desnormalizadas.
  //
  // ⚠️ La clasificación se lee VIVA de `Pregunta`. Hoy da el valor histórico
  // correcto porque no hay ninguna forma de reclasificar una pregunta (el único
  // PATCH /preguntas/:id es el toggle de papelera). El día que exista ese
  // endpoint, estas métricas se reescriben hacia atrás — y por eso las columnas
  // `baseConocimientoId`/`nivelId` en `Respuesta` van en la MISMA story que la
  // reclasificación, no después. Ver docs/pendientes.md.
  private agruparPorBase(
    preguntas: {
      id: string;
      base: { id: string; nombre: string } | null;
      nivel: { id: string; nombre: string; orden: number } | null;
    }[],
    conteo: Map<string, Conteo>,
  ): EstadisticaBase[] {
    const bases = new Map<
      string,
      {
        baseId: string | null;
        baseNombre: string;
        total: Conteo;
        niveles: Map<
          string,
          { nivelId: string | null; nivelNombre: string; orden: number } & {
            total: Conteo;
          }
        >;
      }
    >();

    for (const p of preguntas) {
      const datos = conteo.get(p.id);
      if (!datos) continue;

      const claveBase = p.base?.id ?? '';
      const base = bases.get(claveBase) ?? {
        baseId: p.base?.id ?? null,
        baseNombre: p.base?.nombre ?? SIN_CLASIFICAR,
        total: { respuestas: 0, correctas: 0 },
        niveles: new Map(),
      };
      sumar(base.total, datos.respuestas, datos.correctas);

      const claveNivel = p.nivel?.id ?? '';
      const nivel = base.niveles.get(claveNivel) ?? {
        nivelId: p.nivel?.id ?? null,
        nivelNombre: p.nivel?.nombre ?? SIN_NIVEL,
        // Sin nivel va al final de la escala de su base.
        orden: p.nivel?.orden ?? Number.MAX_SAFE_INTEGER,
        total: { respuestas: 0, correctas: 0 },
      };
      sumar(nivel.total, datos.respuestas, datos.correctas);
      base.niveles.set(claveNivel, nivel);
      bases.set(claveBase, base);
    }

    return [...bases.values()]
      .map((b) => ({
        baseId: b.baseId,
        baseNombre: b.baseNombre,
        respuestas: b.total.respuestas,
        correctas: b.total.correctas,
        porcentaje: Math.round((b.total.correctas / b.total.respuestas) * 100),
        niveles: [...b.niveles.values()]
          // Por el `orden` de la escala, no por porcentaje ni alfabético: la
          // escala de una base es ORDINAL (Básico → Avanzado) y leerla
          // desordenada no dice nada.
          .sort((x, y) => x.orden - y.orden)
          .map((n) => ({
            nivelId: n.nivelId,
            nivelNombre: n.nivelNombre,
            respuestas: n.total.respuestas,
            correctas: n.total.correctas,
            porcentaje: Math.round(
              (n.total.correctas / n.total.respuestas) * 100,
            ),
          })),
      }))
      // Alfabético, con "Sin clasificar" al final: es backlog, no un tema.
      .sort((a, b) => {
        if (a.baseId === null) return 1;
        if (b.baseId === null) return -1;
        return a.baseNombre.localeCompare(b.baseNombre, 'es');
      });
  }

  /**
   * % de acierto por centro de costo y por puesto.
   *
   * ⚠️ **Doble conteo a propósito.** Una persona con dos pares (Soldador·Taller
   * y Electricista·Depósito) rinde UNA vez, pero sus respuestas suman al
   * porcentaje de los dos centros y de los dos puestos: efectivamente trabaja
   * en los dos lugares y su conocimiento cuenta en los dos. La consecuencia es
   * que **las filas suman más que `totales.respuestas`**, y el backoffice tiene
   * que decirlo en pantalla — si no, alguien suma la columna, no le cierra
   * contra el total y concluye que el reporte está roto.
   *
   * Lo que sí se evita es contar dos veces dentro del MISMO centro: alguien con
   * Soldador·Taller y Electricista·Taller cuenta una sola vez en Taller (de ahí
   * los `Set` por usuario).
   */
  private agruparPorCatalogo(
    porUsuario: {
      usuarioId: number;
      _sum: { correctas: number | null; total: number | null };
      _count: { _all: number };
    }[],
    pares: {
      puestoId: string;
      centroCostoId: string;
      puesto: { nombre: string };
      centroCosto: { nombre: string };
      vinculacion: { usuarioId: number };
    }[],
  ): {
    porCentroCosto: EstadisticaCatalogo[];
    porPuesto: EstadisticaCatalogo[];
  } {
    const centrosDe = new Map<number, Map<string, string>>();
    const puestosDe = new Map<number, Map<string, string>>();
    for (const par of pares) {
      const id = par.vinculacion.usuarioId;
      const centros = centrosDe.get(id) ?? new Map<string, string>();
      centros.set(par.centroCostoId, par.centroCosto.nombre);
      centrosDe.set(id, centros);

      const puestos = puestosDe.get(id) ?? new Map<string, string>();
      puestos.set(par.puestoId, par.puesto.nombre);
      puestosDe.set(id, puestos);
    }

    type Acumulado = Omit<EstadisticaCatalogo, 'porcentaje'>;
    const acumular = (destino: Map<number, Map<string, string>>) => {
      const acc = new Map<string, Acumulado>();
      for (const u of porUsuario) {
        for (const [id, nombre] of destino.get(u.usuarioId) ?? []) {
          const fila = acc.get(id) ?? {
            id,
            nombre,
            personas: 0,
            sesiones: 0,
            respuestas: 0,
            correctas: 0,
          };
          fila.personas += 1;
          fila.sesiones += u._count._all;
          fila.respuestas += u._sum.total ?? 0;
          fila.correctas += u._sum.correctas ?? 0;
          acc.set(id, fila);
        }
      }
      return [...acc.values()]
        .map((f) => ({
          ...f,
          porcentaje:
            f.respuestas === 0
              ? 0
              : Math.round((f.correctas / f.respuestas) * 100),
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    };

    return {
      porCentroCosto: acumular(centrosDe),
      porPuesto: acumular(puestosDe),
    };
  }
}
