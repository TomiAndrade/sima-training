import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { InvitadosService } from './invitados.service';

// Una fila de sesiones_invitado, con lo justo que lee el service.
const prueba = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'sesion-1',
  nombre: 'Juan',
  correctas: 8,
  total: 10,
  porcentaje: 80,
  aprobada: true,
  createdAt: new Date('2026-09-01T10:00:00Z'),
  moduloVersion: {
    moduloId: 'mod-basico',
    modulo: { nombre: 'SIMA Básico' },
  },
  ...over,
});

describe('InvitadosService', () => {
  let service: InvitadosService;
  let prisma: { sesionInvitado: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { sesionInvitado: { findMany: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitadosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(InvitadosService);
  });

  it('sin pruebas: porcentajes en null y no en cero', async () => {
    prisma.sesionInvitado.findMany.mockResolvedValue([]);

    const res = await service.estadisticas();

    // 0 % se leería como "prueban todos y desaprueban todos", que es una
    // lectura muy distinta de "todavía no probó nadie".
    expect(res.totales).toEqual({
      pruebas: 0,
      nombres: 0,
      aprobadas: 0,
      porcentajeAprobacion: null,
      respuestas: 0,
      correctas: 0,
      porcentajeAcierto: null,
    });
    expect(res.porModulo).toEqual([]);
    expect(res.recientes).toEqual([]);
  });

  it('cuenta pruebas, aprobadas y acierto sobre el total de respuestas', async () => {
    prisma.sesionInvitado.findMany.mockResolvedValue([
      prueba({ correctas: 8, total: 10, aprobada: true }),
      prueba({ id: 's2', correctas: 4, total: 10, aprobada: false }),
    ]);

    const res = await service.estadisticas();

    expect(res.totales).toMatchObject({
      pruebas: 2,
      aprobadas: 1,
      porcentajeAprobacion: 50,
      respuestas: 20,
      correctas: 12,
      porcentajeAcierto: 60,
    });
  });

  it('cuenta nombres distintos normalizando mayúsculas, acentos y espacios', async () => {
    prisma.sesionInvitado.findMany.mockResolvedValue([
      prueba({ nombre: 'Juan Pérez' }),
      prueba({ id: 's2', nombre: 'juan perez' }),
      prueba({ id: 's3', nombre: '  JUAN   PEREZ ' }),
      prueba({ id: 's4', nombre: 'Ana' }),
    ]);

    const res = await service.estadisticas();

    expect(res.totales.pruebas).toBe(4);
    expect(res.totales.nombres).toBe(2);
  });

  it('colapsa las versiones de un mismo módulo en una sola fila', async () => {
    prisma.sesionInvitado.findMany.mockResolvedValue([
      prueba({ aprobada: true }),
      prueba({
        id: 's2',
        aprobada: false,
        // Otra versión del MISMO módulo: al reporte le interesa el módulo, no
        // cómo se reparte entre la 2026.01.00 y la 2026.01.01.
        moduloVersion: {
          moduloId: 'mod-basico',
          modulo: { nombre: 'SIMA Básico' },
        },
      }),
    ]);

    const res = await service.estadisticas();

    expect(res.porModulo).toEqual([
      {
        moduloId: 'mod-basico',
        moduloNombre: 'SIMA Básico',
        pruebas: 2,
        aprobadas: 1,
        porcentajeAprobacion: 50,
      },
    ]);
  });

  it('ordena porModulo por nombre para que las filas no salten entre cargas', async () => {
    prisma.sesionInvitado.findMany.mockResolvedValue([
      prueba({
        moduloVersion: {
          moduloId: 'mod-oro',
          modulo: { nombre: 'Reglas de Oro' },
        },
      }),
      prueba({
        id: 's2',
        moduloVersion: {
          moduloId: 'mod-basico',
          modulo: { nombre: 'SIMA Básico' },
        },
      }),
      prueba({
        id: 's3',
        moduloVersion: {
          moduloId: 'mod-oro',
          modulo: { nombre: 'Reglas de Oro' },
        },
      }),
    ]);

    const res = await service.estadisticas();

    expect(res.porModulo.map((m) => m.moduloNombre)).toEqual([
      'Reglas de Oro',
      'SIMA Básico',
    ]);
  });

  it('recientes trae nombre, módulo, resultado y la fecha del SERVIDOR', async () => {
    const createdAt = new Date('2026-09-01T10:00:00Z');
    prisma.sesionInvitado.findMany.mockResolvedValue([
      prueba({ nombre: 'Ana', createdAt }),
    ]);

    const res = await service.estadisticas();

    expect(res.recientes).toEqual([
      {
        sesionId: 'sesion-1',
        nombre: 'Ana',
        moduloNombre: 'SIMA Básico',
        correctas: 8,
        total: 10,
        porcentaje: 80,
        aprobada: true,
        fecha: createdAt,
      },
    ]);
  });

  it('recientes se corta en 50 pero los totales cuentan todo', async () => {
    prisma.sesionInvitado.findMany.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) =>
        prueba({ id: `s${i}`, nombre: `Invitado ${i}` }),
      ),
    );

    const res = await service.estadisticas();

    expect(res.recientes).toHaveLength(50);
    expect(res.totales.pruebas).toBe(60);
    expect(res.totales.nombres).toBe(60);
  });

  it('pide las sesiones más recientes primero', async () => {
    prisma.sesionInvitado.findMany.mockResolvedValue([]);
    await service.estadisticas();

    expect(prisma.sesionInvitado.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });
});
