import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AsignacionesService } from './asignaciones.service';

// Par (puesto, centro) como lo devuelve vinculacionPuestoCentro.findMany.
const par = (puestoId: string, centroCostoId: string) => ({
  puestoId,
  centroCostoId,
});

// Asignación vigente como la lee recalcular (select id/moduloId/origen).
const vigente = (
  id: string,
  moduloId: string,
  origen: 'AUTOMATICA' | 'MANUAL',
) => ({ id, moduloId, origen });

describe('AsignacionesService.recalcular', () => {
  let service: AsignacionesService;
  let prisma: {
    usuario: { findFirst: jest.Mock };
    vinculacionPuestoCentro: { findMany: jest.Mock };
    reglaAsignacion: { findMany: jest.Mock };
    asignacion: {
      findMany: jest.Mock;
      createMany: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      usuario: { findFirst: jest.fn() },
      vinculacionPuestoCentro: { findMany: jest.fn() },
      reglaAsignacion: { findMany: jest.fn() },
      asignacion: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    // Por defecto: usuario existe, sin vigentes previas.
    prisma.usuario.findFirst.mockResolvedValue({ id: 1 });
    prisma.asignacion.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsignacionesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AsignacionesService);
  });

  it('crea la unión de módulos de todos los pares', async () => {
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
      par('p-amolador', 'c-pae'),
    ]);
    // Un par pide m1, el otro m2.
    prisma.reglaAsignacion.findMany.mockResolvedValue([
      { moduloId: 'm1' },
      { moduloId: 'm2' },
    ]);
    prisma.asignacion.createMany.mockResolvedValue({ count: 2 });

    const res = await service.recalcular(1);

    expect(res).toEqual({ creadas: 2, revocadas: 0 });
    expect(prisma.asignacion.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          usuarioId: 1,
          moduloId: 'm1',
          origen: 'AUTOMATICA',
        }),
        expect.objectContaining({
          usuarioId: 1,
          moduloId: 'm2',
          origen: 'AUTOMATICA',
        }),
      ],
    });
    expect(prisma.asignacion.updateMany).not.toHaveBeenCalled();
  });

  it('un módulo pedido por dos pares es una sola asignación', async () => {
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
      par('p-soldador', 'c-pae'),
    ]);
    // Los dos pares piden el MISMO módulo.
    prisma.reglaAsignacion.findMany.mockResolvedValue([
      { moduloId: 'm1' },
      { moduloId: 'm1' },
    ]);
    prisma.asignacion.createMany.mockResolvedValue({ count: 1 });

    const res = await service.recalcular(1);

    expect(res).toEqual({ creadas: 1, revocadas: 0 });
    expect(prisma.asignacion.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ moduloId: 'm1' })],
    });
  });

  it('revoca la AUTOMATICA cuando se le saca el par que la pedía', async () => {
    // La persona ya no tiene pares activos → nada requerido.
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([]);
    prisma.asignacion.findMany.mockResolvedValue([
      vigente('a1', 'm1', 'AUTOMATICA'),
    ]);
    prisma.asignacion.updateMany.mockResolvedValue({ count: 1 });

    const res = await service.recalcular(1);

    expect(res).toEqual({ creadas: 0, revocadas: 1 });
    expect(prisma.asignacion.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a1'] } },
      data: expect.objectContaining({ revocadaAt: expect.any(Date) }),
    });
    expect(prisma.asignacion.createMany).not.toHaveBeenCalled();
    // Sin pares no se consultan reglas (evita un OR: []).
    expect(prisma.reglaAsignacion.findMany).not.toHaveBeenCalled();
  });

  it('nunca revoca ni duplica una asignación MANUAL', async () => {
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([{ moduloId: 'm1' }]);
    // Ya existe una MANUAL vigente del mismo módulo requerido.
    prisma.asignacion.findMany.mockResolvedValue([
      vigente('a1', 'm1', 'MANUAL'),
    ]);

    const res = await service.recalcular(1);

    // No la duplica (ya cubierto) ni la revoca (es MANUAL).
    expect(res).toEqual({ creadas: 0, revocadas: 0 });
    expect(prisma.asignacion.createMany).not.toHaveBeenCalled();
    expect(prisma.asignacion.updateMany).not.toHaveBeenCalled();
  });

  it('es idempotente: en régimen no crea ni revoca nada', async () => {
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([{ moduloId: 'm1' }]);
    // El módulo requerido ya tiene su AUTOMATICA vigente.
    prisma.asignacion.findMany.mockResolvedValue([
      vigente('a1', 'm1', 'AUTOMATICA'),
    ]);

    const res = await service.recalcular(1);

    expect(res).toEqual({ creadas: 0, revocadas: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.asignacion.createMany).not.toHaveBeenCalled();
    expect(prisma.asignacion.updateMany).not.toHaveBeenCalled();
  });

  it('lanza NotFound si el usuario no existe o está dado de baja', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(service.recalcular(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.vinculacionPuestoCentro.findMany).not.toHaveBeenCalled();
  });

  it('no re-asigna un módulo ya aprobado, pero no revoca su AUTOMATICA si un par lo sigue pidiendo', async () => {
    // m1 ya aprobado; m1 y m2 requeridos por los pares; m1 ya tiene AUTOMATICA.
    jest
      .spyOn(
        service as unknown as { modulosAprobados: () => Promise<Set<string>> },
        'modulosAprobados',
      )
      .mockResolvedValue(new Set(['m1']));
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([
      { moduloId: 'm1' },
      { moduloId: 'm2' },
    ]);
    prisma.asignacion.findMany.mockResolvedValue([
      vigente('a1', 'm1', 'AUTOMATICA'),
    ]);
    prisma.asignacion.createMany.mockResolvedValue({ count: 1 });

    const res = await service.recalcular(1);

    // Sólo se crea m2 (m1 está aprobado → no se re-asigna). m1 sigue requerido
    // por el par, así que su AUTOMATICA no se revoca.
    expect(res).toEqual({ creadas: 1, revocadas: 0 });
    expect(prisma.asignacion.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ moduloId: 'm2' })],
    });
    expect(prisma.asignacion.updateMany).not.toHaveBeenCalled();
  });
});
