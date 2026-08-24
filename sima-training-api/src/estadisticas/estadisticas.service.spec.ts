import { Test } from '@nestjs/testing';
import { TipoPregunta } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EstadisticasService } from './estadisticas.service';

// Doble de Prisma, mismo patrón que resumen.service.spec.ts: cada test declara
// qué devuelve cada query. El service no escribe nada, así que alcanza con los
// reads.
function prismaFake(over: {
  aciertos?: unknown[];
  opciones?: unknown[];
  preguntas?: unknown[];
  pool?: unknown[];
  porUsuario?: unknown[];
  pares?: unknown[];
}) {
  return {
    respuesta: {
      // Los dos groupBy se distinguen por lo único que los diferencia en la
      // llamada: uno agrupa por `correcta` y el otro por `respuestaDada`.
      groupBy: jest.fn((args: { by: string[] }) =>
        Promise.resolve(
          args.by.includes('correcta')
            ? (over.aciertos ?? [])
            : (over.opciones ?? []),
        ),
      ),
    },
    pregunta: { findMany: jest.fn().mockResolvedValue(over.preguntas ?? []) },
    moduloVersionPregunta: {
      findMany: jest.fn().mockResolvedValue(over.pool ?? []),
    },
    sesion: { groupBy: jest.fn().mockResolvedValue(over.porUsuario ?? []) },
    vinculacionPuestoCentro: {
      findMany: jest.fn().mockResolvedValue(over.pares ?? []),
    },
  };
}

async function servicio(fake: ReturnType<typeof prismaFake>) {
  const mod = await Test.createTestingModule({
    providers: [EstadisticasService, { provide: PrismaService, useValue: fake }],
  }).compile();
  return mod.get(EstadisticasService);
}

const pregunta = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  texto: '¿Qué significa EPP?',
  tipo: TipoPregunta.OPCION_MULTIPLE,
  activa: true,
  opciones: ['Elemento de protección personal', 'Equipo previo de planta'],
  respuestaCorrecta: 'Elemento de protección personal',
  base: { id: 'b1', nombre: 'Seguridad' },
  nivel: { id: 'n1', nombre: 'Básico', orden: 1 },
  ...over,
});

// Las dos filas que devuelve el groupBy de aciertos para una pregunta.
const aciertos = (preguntaId: string, correctas: number, incorrectas: number) =>
  [
    { preguntaId, correcta: true, _count: { _all: correctas } },
    { preguntaId, correcta: false, _count: { _all: incorrectas } },
  ].filter((f) => f._count._all > 0);

describe('EstadisticasService', () => {
  describe('base de datos vacía', () => {
    it('no divide por cero y devuelve porcentaje null, no 0', async () => {
      const srv = await servicio(prismaFake({}));
      const res = await srv.simaCheck();

      // null y no 0: 0 % se leería como "contestan y fallan todos", que es una
      // conclusión muy distinta de "todavía nadie rindió".
      expect(res.totales.porcentaje).toBeNull();
      expect(res.totales).toMatchObject({
        sesiones: 0,
        respuestas: 0,
        correctas: 0,
        preguntasConDatos: 0,
        preguntasEnPoolSinDatos: 0,
      });
      expect(res.preguntas).toEqual([]);
      expect(res.porBase).toEqual([]);
      expect(res.porCentroCosto).toEqual([]);
      expect(res.porPuesto).toEqual([]);
    });
  });

  describe('ranking de preguntas', () => {
    it('ordena por cantidad de INCORRECTAS, no por porcentaje', async () => {
      // `pocas` tiene peor porcentaje (0 %) pero una sola respuesta: no puede
      // encabezar el ranking, que es justamente el ruido que evita ordenar por
      // errores absolutos.
      const srv = await servicio(
        prismaFake({
          preguntas: [
            pregunta({ id: 'muchas', texto: 'A' }),
            pregunta({ id: 'pocas', texto: 'B' }),
          ],
          aciertos: [...aciertos('muchas', 10, 8), ...aciertos('pocas', 0, 1)],
        }),
      );
      const res = await srv.simaCheck();

      expect(res.preguntas.map((p) => p.preguntaId)).toEqual([
        'muchas',
        'pocas',
      ]);
      expect(res.preguntas[0]).toMatchObject({
        respuestas: 18,
        correctas: 10,
        incorrectas: 8,
        porcentajeAcierto: 56,
      });
      expect(res.preguntas[1].porcentajeAcierto).toBe(0);
    });

    it('desempata de forma determinística para que el orden no cambie entre dos cargas', async () => {
      const srv = await servicio(
        prismaFake({
          preguntas: [
            pregunta({ id: 'z', texto: 'Zeta' }),
            pregunta({ id: 'a', texto: 'Alfa' }),
          ],
          aciertos: [...aciertos('z', 5, 3), ...aciertos('a', 5, 3)],
        }),
      );
      const res = await srv.simaCheck();

      // Mismos errores y mismas respuestas: desempata por texto.
      expect(res.preguntas.map((p) => p.preguntaId)).toEqual(['a', 'z']);
    });

    it('incluye una pregunta del pool activo sin respuestas, con porcentaje null', async () => {
      const srv = await servicio(
        prismaFake({
          preguntas: [pregunta({ id: 'nunca' })],
          pool: [{ preguntaId: 'nunca' }],
        }),
      );
      const res = await srv.simaCheck();

      expect(res.preguntas).toHaveLength(1);
      expect(res.preguntas[0]).toMatchObject({
        preguntaId: 'nunca',
        respuestas: 0,
        porcentajeAcierto: null,
        enPoolActivo: true,
        distribucion: [],
      });
      expect(res.totales.preguntasEnPoolSinDatos).toBe(1);
      expect(res.totales.preguntasConDatos).toBe(0);
    });

    it('descarta una pregunta sin respuestas que además está fuera de todo módulo activo', async () => {
      // No es un hallazgo de este reporte: "no está asignada a ningún módulo"
      // ya lo responde ?sinAsignar=true en la pantalla Preguntas.
      const srv = await servicio(
        prismaFake({ preguntas: [pregunta({ id: 'huerfana' })] }),
      );
      const res = await srv.simaCheck();

      expect(res.preguntas).toEqual([]);
    });
  });

  describe('distribución de respuestas', () => {
    it('marca la correcta, ordena por cantidad y conserva el "no contestó"', async () => {
      const srv = await servicio(
        prismaFake({
          preguntas: [pregunta()],
          aciertos: aciertos('p1', 2, 4),
          opciones: [
            {
              preguntaId: 'p1',
              respuestaDada: 'Elemento de protección personal',
              _count: { _all: 2 },
            },
            {
              preguntaId: 'p1',
              respuestaDada: 'Equipo previo de planta',
              _count: { _all: 3 },
            },
            // null = no contestó. Es un estado real y se lista como uno más.
            { preguntaId: 'p1', respuestaDada: null, _count: { _all: 1 } },
          ],
        }),
      );
      const res = await srv.simaCheck();

      expect(res.preguntas[0].distribucion).toEqual([
        {
          valor: 'Equipo previo de planta',
          veces: 3,
          esCorrecta: false,
          entreOpciones: true,
        },
        {
          valor: 'Elemento de protección personal',
          veces: 2,
          esCorrecta: true,
          entreOpciones: true,
        },
        { valor: null, veces: 1, esCorrecta: false, entreOpciones: false },
      ]);
    });

    it('lista igual un valor que ya no figura entre las opciones, marcándolo', async () => {
      const srv = await servicio(
        prismaFake({
          preguntas: [pregunta()],
          aciertos: aciertos('p1', 0, 1),
          opciones: [
            {
              preguntaId: 'p1',
              respuestaDada: 'Una opción que ya no existe',
              _count: { _all: 1 },
            },
          ],
        }),
      );
      const res = await srv.simaCheck();

      // Se muestra en vez de desaparecer: si no, la distribución no cerraría
      // contra el total de respuestas y nadie sabría por qué.
      expect(res.preguntas[0].distribucion[0]).toMatchObject({
        valor: 'Una opción que ya no existe',
        entreOpciones: false,
      });
    });

    it('reconoce las opciones de VERDADERO_FALSO, que no están en el jsonb', async () => {
      const srv = await servicio(
        prismaFake({
          preguntas: [
            pregunta({
              tipo: TipoPregunta.VERDADERO_FALSO,
              opciones: null,
              respuestaCorrecta: 'Verdadero',
            }),
          ],
          aciertos: aciertos('p1', 1, 1),
          opciones: [
            { preguntaId: 'p1', respuestaDada: 'Verdadero', _count: { _all: 1 } },
            { preguntaId: 'p1', respuestaDada: 'Falso', _count: { _all: 1 } },
          ],
        }),
      );
      const res = await srv.simaCheck();

      // Sin el caso especial de V/F las dos saldrían como entreOpciones: false,
      // o sea "eligió algo que no estaba entre las opciones".
      expect(
        res.preguntas[0].distribucion.every((d) => d.entreOpciones),
      ).toBe(true);
    });
  });

  describe('acierto por base y nivel', () => {
    it('agrupa por tema y ordena los niveles por su orden ordinal, no alfabético', async () => {
      const srv = await servicio(
        prismaFake({
          preguntas: [
            pregunta({
              id: 'av',
              nivel: { id: 'n2', nombre: 'Avanzado', orden: 2 },
            }),
            pregunta({
              id: 'ba',
              nivel: { id: 'n1', nombre: 'Básico', orden: 1 },
            }),
          ],
          aciertos: [...aciertos('av', 2, 8), ...aciertos('ba', 9, 1)],
        }),
      );
      const res = await srv.simaCheck();

      expect(res.porBase).toHaveLength(1);
      expect(res.porBase[0]).toMatchObject({
        baseId: 'b1',
        baseNombre: 'Seguridad',
        respuestas: 20,
        correctas: 11,
        porcentaje: 55,
      });
      // Básico primero por `orden`, aunque alfabéticamente iría después.
      expect(res.porBase[0].niveles.map((n) => n.nivelNombre)).toEqual([
        'Básico',
        'Avanzado',
      ]);
      expect(res.porBase[0].niveles[0].porcentaje).toBe(90);
      expect(res.porBase[0].niveles[1].porcentaje).toBe(20);
    });

    it('manda "Sin clasificar" al final y no pierde sus respuestas', async () => {
      const srv = await servicio(
        prismaFake({
          preguntas: [
            pregunta({ id: 'sin', base: null, nivel: null }),
            pregunta({ id: 'con' }),
          ],
          aciertos: [...aciertos('sin', 1, 1), ...aciertos('con', 1, 1)],
        }),
      );
      const res = await srv.simaCheck();

      expect(res.porBase.map((b) => b.baseNombre)).toEqual([
        'Seguridad',
        'Sin clasificar',
      ]);
      expect(res.porBase[1].niveles[0].nivelNombre).toBe('Sin nivel');
      // Los porBase suman igual que el total: nada se pierde por el camino.
      const suma = res.porBase.reduce((acc, b) => acc + b.respuestas, 0);
      expect(suma).toBe(res.totales.respuestas);
    });
  });

  describe('cortes por centro de costo y puesto', () => {
    const porUsuario = [
      {
        usuarioId: 1,
        _sum: { correctas: 8, total: 10 },
        _count: { _all: 1 },
      },
    ];

    it('cuenta a una persona con dos pares en LOS DOS centros (doble conteo a propósito)', async () => {
      const srv = await servicio(
        prismaFake({
          porUsuario,
          pares: [
            {
              puestoId: 'pu1',
              centroCostoId: 'c1',
              puesto: { nombre: 'Soldador' },
              centroCosto: { nombre: 'Taller' },
              vinculacion: { usuarioId: 1 },
            },
            {
              puestoId: 'pu2',
              centroCostoId: 'c2',
              puesto: { nombre: 'Electricista' },
              centroCosto: { nombre: 'Depósito' },
              vinculacion: { usuarioId: 1 },
            },
          ],
        }),
      );
      const res = await srv.simaCheck();

      expect(res.porCentroCosto).toHaveLength(2);
      for (const fila of res.porCentroCosto) {
        expect(fila).toMatchObject({
          personas: 1,
          sesiones: 1,
          respuestas: 10,
          correctas: 8,
          porcentaje: 80,
        });
      }
      // Es la consecuencia declarada: las filas suman MÁS que el total.
      const suma = res.porCentroCosto.reduce((a, f) => a + f.respuestas, 0);
      expect(suma).toBe(20);
    });

    it('NO cuenta dos veces dentro del mismo centro', async () => {
      const srv = await servicio(
        prismaFake({
          porUsuario,
          pares: [
            {
              puestoId: 'pu1',
              centroCostoId: 'c1',
              puesto: { nombre: 'Soldador' },
              centroCosto: { nombre: 'Taller' },
              vinculacion: { usuarioId: 1 },
            },
            {
              puestoId: 'pu2',
              centroCostoId: 'c1',
              puesto: { nombre: 'Electricista' },
              centroCosto: { nombre: 'Taller' },
              vinculacion: { usuarioId: 1 },
            },
          ],
        }),
      );
      const res = await srv.simaCheck();

      expect(res.porCentroCosto).toHaveLength(1);
      expect(res.porCentroCosto[0]).toMatchObject({
        nombre: 'Taller',
        personas: 1,
        respuestas: 10,
      });
      // Dos puestos distintos en el mismo centro: dos filas del lado de puesto.
      expect(res.porPuesto).toHaveLength(2);
    });

    it('deja fuera de los cortes a quien no tiene ningún par activo', async () => {
      const srv = await servicio(prismaFake({ porUsuario, pares: [] }));
      const res = await srv.simaCheck();

      // Sus sesiones cuentan en el total, pero no hay dónde ubicarlas.
      expect(res.totales.sesiones).toBe(1);
      expect(res.porCentroCosto).toEqual([]);
      expect(res.porPuesto).toEqual([]);
    });
  });

  it('no expone la respuesta correcta en ningún lado del payload', async () => {
    // Es lo que permite que este endpoint quede abierto sin guard, a
    // diferencia de GET /sesiones/:id. Si alguna vez se agrega el campo, este
    // test falla y obliga a decidir el guard a propósito.
    const srv = await servicio(
      prismaFake({
        preguntas: [pregunta()],
        aciertos: aciertos('p1', 1, 1),
        opciones: [
          {
            preguntaId: 'p1',
            respuestaDada: 'Elemento de protección personal',
            _count: { _all: 1 },
          },
        ],
      }),
    );
    const res = await srv.simaCheck();

    expect(JSON.stringify(res)).not.toContain('respuestaCorrecta');
  });
});
