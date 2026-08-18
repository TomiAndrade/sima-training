import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ResumenService } from './resumen.service';

const MES = 30 * 24 * 60 * 60 * 1000;
const haceMeses = (n: number) => new Date(Date.now() - n * MES);

// Doble de Prisma: cada test declara qué devuelve cada query. El service no
// escribe nada, así que alcanza con los reads.
function prismaFake(over: {
  asignaciones?: unknown[];
  aprobadas?: unknown[];
  totalUsuarios?: number;
  sesionesPorAprobada?: unknown[];
  recientes?: unknown[];
  porVersion?: unknown[];
  versiones?: unknown[];
}) {
  return {
    asignacion: { findMany: jest.fn().mockResolvedValue(over.asignaciones ?? []) },
    usuario: { count: jest.fn().mockResolvedValue(over.totalUsuarios ?? 0) },
    moduloVersion: {
      findMany: jest.fn().mockResolvedValue(over.versiones ?? []),
    },
    sesion: {
      // `findMany` lo llaman dos consumidores distintos: las aprobadas (para
      // el vencimiento) y las recientes (que llevan `take`). Se distinguen por
      // ahí, que es lo único que las diferencia en la llamada.
      findMany: jest.fn((args: { take?: number }) =>
        Promise.resolve(args?.take ? (over.recientes ?? []) : (over.aprobadas ?? [])),
      ),
      // Ídem groupBy: el de aprobación general agrupa sólo por `aprobada`; el
      // del gráfico suma `moduloVersionId`.
      groupBy: jest.fn((args: { by: string[] }) =>
        Promise.resolve(
          args.by.includes('moduloVersionId')
            ? (over.porVersion ?? [])
            : (over.sesionesPorAprobada ?? []),
        ),
      ),
    },
  };
}

async function servicio(fake: ReturnType<typeof prismaFake>) {
  const mod = await Test.createTestingModule({
    providers: [ResumenService, { provide: PrismaService, useValue: fake }],
  }).compile();
  return mod.get(ResumenService);
}

const asignacion = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  usuarioId: 1,
  moduloId: 'm1',
  revocadaAt: null,
  modulo: { nombre: 'Trabajo en Altura', vigenciaMeses: 12 },
  ...over,
});

describe('ResumenService.simaCheck', () => {
  describe('habilitación', () => {
    it('cuenta NO_HABILITADO a quien tiene una aprobación vencida', async () => {
      const svc = await servicio(
        prismaFake({
          asignaciones: [asignacion()],
          aprobadas: [
            // Aprobó hace 18 meses un módulo que vence a los 12.
            {
              usuarioId: 1,
              createdAt: haceMeses(18),
              moduloVersion: { moduloId: 'm1' },
            },
          ],
          totalUsuarios: 1,
        }),
      );

      const r = await svc.simaCheck();

      expect(r.habilitacion.NO_HABILITADO).toBe(1);
      expect(r.habilitacion.EN_REGLA).toBe(0);
    });

    it('cuenta PENDIENTE a quien nunca aprobó', async () => {
      const svc = await servicio(
        prismaFake({ asignaciones: [asignacion()], totalUsuarios: 1 }),
      );

      const r = await svc.simaCheck();

      expect(r.habilitacion.PENDIENTE).toBe(1);
    });

    it('cuenta EN_REGLA a quien aprobó dentro de la vigencia', async () => {
      const svc = await servicio(
        prismaFake({
          asignaciones: [asignacion()],
          aprobadas: [
            {
              usuarioId: 1,
              createdAt: haceMeses(1),
              moduloVersion: { moduloId: 'm1' },
            },
          ],
          totalUsuarios: 1,
        }),
      );

      const r = await svc.simaCheck();

      expect(r.habilitacion.EN_REGLA).toBe(1);
    });

    it('una sola persona cuenta UNA vez aunque tenga varias asignaciones', async () => {
      const svc = await servicio(
        prismaFake({
          asignaciones: [
            asignacion({ id: 'a1', moduloId: 'm1' }),
            asignacion({ id: 'a2', moduloId: 'm2' }),
            asignacion({ id: 'a3', moduloId: 'm3' }),
          ],
          totalUsuarios: 1,
        }),
      );

      const r = await svc.simaCheck();

      // El dashboard cuenta PERSONAS, no obligaciones: si contara asignaciones,
      // alguien con 3 módulos pendientes se vería como 3 personas.
      expect(r.habilitacion.PENDIENTE).toBe(1);
      expect(r.habilitacion.total).toBe(1);
    });

    it('gana el estado más grave: vencida + pendiente = NO_HABILITADO', async () => {
      const svc = await servicio(
        prismaFake({
          asignaciones: [
            asignacion({ id: 'a1', moduloId: 'm1' }),
            asignacion({ id: 'a2', moduloId: 'm2' }),
          ],
          aprobadas: [
            {
              usuarioId: 1,
              createdAt: haceMeses(18),
              moduloVersion: { moduloId: 'm1' },
            },
          ],
          totalUsuarios: 1,
        }),
      );

      const r = await svc.simaCheck();

      expect(r.habilitacion.NO_HABILITADO).toBe(1);
      expect(r.habilitacion.PENDIENTE).toBe(0);
    });

    it('los usuarios sin ninguna asignación caen en SIN_OBLIGACIONES', async () => {
      const svc = await servicio(
        prismaFake({
          asignaciones: [asignacion({ usuarioId: 1 })],
          // 10 usuarios vivos, uno solo con asignaciones.
          totalUsuarios: 10,
        }),
      );

      const r = await svc.simaCheck();

      expect(r.habilitacion.PENDIENTE).toBe(1);
      expect(r.habilitacion.SIN_OBLIGACIONES).toBe(9);
      expect(r.habilitacion.total).toBe(10);
    });

    it('los estados suman el total: nadie se cuenta dos veces ni se pierde', async () => {
      const svc = await servicio(
        prismaFake({
          asignaciones: [
            asignacion({ id: 'a1', usuarioId: 1, moduloId: 'm1' }),
            asignacion({ id: 'a2', usuarioId: 2, moduloId: 'm1' }),
          ],
          aprobadas: [
            {
              usuarioId: 2,
              createdAt: haceMeses(1),
              moduloVersion: { moduloId: 'm1' },
            },
          ],
          totalUsuarios: 5,
        }),
      );

      const { habilitacion: h } = await svc.simaCheck();
      const suma =
        h.NO_HABILITADO + h.PENDIENTE + h.POR_VENCER + h.EN_REGLA + h.SIN_OBLIGACIONES;

      expect(suma).toBe(h.total);
    });

    it('la aprobación MÁS RECIENTE manda: reaprobar reinicia el reloj', async () => {
      const svc = await servicio(
        prismaFake({
          asignaciones: [asignacion()],
          aprobadas: [
            {
              usuarioId: 1,
              createdAt: haceMeses(18),
              moduloVersion: { moduloId: 'm1' },
            },
            {
              usuarioId: 1,
              createdAt: haceMeses(1),
              moduloVersion: { moduloId: 'm1' },
            },
          ],
          totalUsuarios: 1,
        }),
      );

      const r = await svc.simaCheck();

      // Con la vieja mandaría, sería NO_HABILITADO.
      expect(r.habilitacion.EN_REGLA).toBe(1);
    });

    it('la aprobación de OTRA persona no cubre la propia', async () => {
      const svc = await servicio(
        prismaFake({
          asignaciones: [asignacion({ usuarioId: 1 })],
          aprobadas: [
            {
              usuarioId: 99,
              createdAt: haceMeses(1),
              moduloVersion: { moduloId: 'm1' },
            },
          ],
          totalUsuarios: 1,
        }),
      );

      const r = await svc.simaCheck();

      expect(r.habilitacion.PENDIENTE).toBe(1);
      expect(r.habilitacion.EN_REGLA).toBe(0);
    });

    it('un módulo sin vigenciaMeses no vence nunca', async () => {
      const svc = await servicio(
        prismaFake({
          asignaciones: [
            asignacion({ modulo: { nombre: 'Inducción', vigenciaMeses: null } }),
          ],
          aprobadas: [
            {
              usuarioId: 1,
              createdAt: haceMeses(60),
              moduloVersion: { moduloId: 'm1' },
            },
          ],
          totalUsuarios: 1,
        }),
      );

      const r = await svc.simaCheck();

      expect(r.habilitacion.EN_REGLA).toBe(1);
    });
  });

  describe('aprobación general', () => {
    it('calcula el porcentaje sobre el total de sesiones', async () => {
      const svc = await servicio(
        prismaFake({
          sesionesPorAprobada: [
            { aprobada: true, _count: { _all: 78 } },
            { aprobada: false, _count: { _all: 22 } },
          ],
        }),
      );

      const r = await svc.simaCheck();

      expect(r.aprobacion).toEqual({
        sesiones: 100,
        aprobadas: 78,
        porcentaje: 78,
      });
    });

    it('devuelve porcentaje null si todavía nadie rindió', async () => {
      const svc = await servicio(prismaFake({}));

      const r = await svc.simaCheck();

      // null y no 0: "0%" se lee como "rinden y desaprueban todos", que es una
      // afirmación muy distinta de "no hay datos".
      expect(r.aprobacion).toEqual({ sesiones: 0, aprobadas: 0, porcentaje: null });
    });
  });

  describe('aprobación por módulo', () => {
    it('colapsa las versiones de un mismo módulo en una sola barra', async () => {
      const svc = await servicio(
        prismaFake({
          porVersion: [
            { moduloVersionId: 'v1', aprobada: true, _count: { _all: 3 } },
            { moduloVersionId: 'v2', aprobada: true, _count: { _all: 1 } },
            { moduloVersionId: 'v2', aprobada: false, _count: { _all: 4 } },
          ],
          versiones: [
            { id: 'v1', moduloId: 'm1', modulo: { nombre: 'Altura' } },
            { id: 'v2', moduloId: 'm1', modulo: { nombre: 'Altura' } },
          ],
        }),
      );

      const r = await svc.simaCheck();

      // Las dos versiones son el mismo módulo evolucionando: separarlas
      // partiría la barra en dos sin que eso signifique nada para quien mira.
      expect(r.porModulo).toEqual([
        {
          moduloId: 'm1',
          moduloNombre: 'Altura',
          sesiones: 8,
          aprobadas: 4,
          porcentaje: 50,
        },
      ]);
    });

    it('ordena por nombre, no por porcentaje', async () => {
      const svc = await servicio(
        prismaFake({
          porVersion: [
            { moduloVersionId: 'v1', aprobada: true, _count: { _all: 1 } },
            { moduloVersionId: 'v2', aprobada: false, _count: { _all: 1 } },
          ],
          versiones: [
            { id: 'v1', moduloId: 'm1', modulo: { nombre: 'Zapatas' } },
            { id: 'v2', moduloId: 'm2', modulo: { nombre: 'Altura' } },
          ],
        }),
      );

      const r = await svc.simaCheck();

      // Por porcentaje, las barras cambiarían de lugar entre dos cargas y el
      // gráfico se volvería ilegible.
      expect(r.porModulo.map((m) => m.moduloNombre)).toEqual(['Altura', 'Zapatas']);
    });

    it('ignora una sesión cuya versión ya no existe, sin romper', async () => {
      const svc = await servicio(
        prismaFake({
          porVersion: [
            { moduloVersionId: 'fantasma', aprobada: true, _count: { _all: 5 } },
          ],
          versiones: [],
        }),
      );

      await expect(svc.simaCheck()).resolves.toHaveProperty('porModulo', []);
    });
  });

  describe('últimas evaluaciones', () => {
    it('arma el nombre completo y el del módulo', async () => {
      const fecha = new Date('2026-08-18T10:00:00Z');
      const svc = await servicio(
        prismaFake({
          recientes: [
            {
              id: 's1',
              porcentaje: 80,
              aprobada: true,
              createdAt: fecha,
              usuario: { nombre: 'Ana', apellido: 'Paz' },
              moduloVersion: { modulo: { nombre: 'Altura' } },
            },
          ],
        }),
      );

      const r = await svc.simaCheck();

      expect(r.recientes).toEqual([
        {
          id: 's1',
          usuarioNombre: 'Ana Paz',
          moduloNombre: 'Altura',
          porcentaje: 80,
          aprobada: true,
          fecha,
        },
      ]);
    });
  });
});
