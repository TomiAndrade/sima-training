import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BasesConocimientoService } from './bases-conocimiento.service';

describe('BasesConocimientoService', () => {
  let service: BasesConocimientoService;
  let prisma: {
    baseConocimiento: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    nivelBase: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      aggregate: jest.Mock;
    };
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
  };

  const BASE_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    prisma = {
      baseConocimiento: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      nivelBase: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      $executeRaw: jest.fn(),
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BasesConocimientoService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(BasesConocimientoService);
  });

  describe('bases', () => {
    it('crea una base con nombre libre', async () => {
      prisma.baseConocimiento.findUnique.mockResolvedValue(null);
      prisma.baseConocimiento.create.mockResolvedValue({ id: BASE_ID });

      await service.create({ nombre: 'Gestión de residuos' });

      expect(prisma.baseConocimiento.create).toHaveBeenCalled();
    });

    it('rechaza una base con nombre duplicado', async () => {
      prisma.baseConocimiento.findUnique.mockResolvedValue({ id: 'otra' });

      await expect(
        service.create({ nombre: 'Gestión de residuos' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza una base con código duplicado', async () => {
      // El nombre está libre, el código no.
      prisma.baseConocimiento.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'otra' });

      await expect(
        service.create({ nombre: 'Trabajo en altura', codigo: 'RES' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('sin ?activa= no filtra: devuelve el catálogo completo', async () => {
      prisma.baseConocimiento.findMany.mockResolvedValue([]);

      await service.findAll({});

      expect(prisma.baseConocimiento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('niveles', () => {
    it('appendea el orden cuando el alta no lo trae', async () => {
      prisma.baseConocimiento.findUnique.mockResolvedValue({ id: BASE_ID });
      prisma.nivelBase.findFirst.mockResolvedValue(null);
      prisma.nivelBase.aggregate.mockResolvedValue({ _max: { orden: 2 } });
      prisma.nivelBase.create.mockResolvedValue({ id: 'n4' });

      await service.crearNivel(BASE_ID, { nombre: 'Avanzado' });

      expect(prisma.nivelBase.create).toHaveBeenCalledWith({
        data: {
          baseConocimientoId: BASE_ID,
          nombre: 'Avanzado',
          orden: 3,
        },
      });
    });

    it('arranca la escala en 0 cuando la base todavía no tiene niveles', async () => {
      prisma.baseConocimiento.findUnique.mockResolvedValue({ id: BASE_ID });
      prisma.nivelBase.findFirst.mockResolvedValue(null);
      prisma.nivelBase.aggregate.mockResolvedValue({ _max: { orden: null } });
      prisma.nivelBase.create.mockResolvedValue({ id: 'n1' });

      await service.crearNivel(BASE_ID, { nombre: 'Básico' });

      expect(prisma.nivelBase.create).toHaveBeenCalledWith({
        data: { baseConocimientoId: BASE_ID, nombre: 'Básico', orden: 0 },
      });
    });

    it('rechaza dos niveles con el mismo nombre en la misma base', async () => {
      prisma.baseConocimiento.findUnique.mockResolvedValue({ id: BASE_ID });
      prisma.nivelBase.findFirst.mockResolvedValue({
        id: 'n1',
        nombre: 'Básico',
      });

      await expect(
        service.crearNivel(BASE_ID, { nombre: 'Básico' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza un nivel de otra base al actualizar', async () => {
      prisma.nivelBase.findUnique.mockResolvedValue({
        id: 'n1',
        baseConocimientoId: 'otra-base',
      });

      await expect(
        service.actualizarNivel(BASE_ID, 'n1', { nombre: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // El índice único (base_conocimiento_id, orden) no es diferible: mover
  // niveles de a uno lo viola a mitad de camino. Estos tests fijan que el
  // reordenamiento pase SIEMPRE por las dos pasadas (negativos → finales), que
  // es lo único que lo evita.
  describe('reordenarNiveles', () => {
    const N1 = '11111111-aaaa-4111-8111-111111111111';
    const N2 = '22222222-aaaa-4111-8111-222222222222';
    const N3 = '33333333-aaaa-4111-8111-333333333333';
    const N4 = '44444444-aaaa-4111-8111-444444444444';
    const N5 = '55555555-aaaa-4111-8111-555555555555';

    const conNiveles = (ids: string[]) => {
      prisma.baseConocimiento.findUnique.mockResolvedValue({ id: BASE_ID });
      prisma.nivelBase.findMany.mockResolvedValue(ids.map((id) => ({ id })));
      prisma.nivelBase.update.mockResolvedValue({});
    };

    const ordenesAsignados = () =>
      prisma.nivelBase.update.mock.calls.map((c) => [
        c[0].where.id,
        c[0].data.orden,
      ]);

    it('intercambia dos niveles adyacentes sin violar la unicidad', async () => {
      conNiveles([N1, N2, N3]);

      await service.reordenarNiveles(BASE_ID, { nivelIds: [N2, N1, N3] });

      // Pasada 1: toda la escala a negativos antes de tocar ningún orden final.
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      // Pasada 2: posiciones finales, contiguas desde 0.
      expect(ordenesAsignados()).toEqual([
        [N2, 0],
        [N1, 1],
        [N3, 2],
      ]);
    });

    it('mueve un nivel a una posición arbitraria (5 → 1)', async () => {
      conNiveles([N1, N2, N3, N4, N5]);

      await service.reordenarNiveles(BASE_ID, {
        nivelIds: [N5, N1, N2, N3, N4],
      });

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(ordenesAsignados()).toEqual([
        [N5, 0],
        [N1, 1],
        [N2, 2],
        [N3, 3],
        [N4, 4],
      ]);
    });

    it('normaliza una escala con huecos a órdenes contiguos desde 0', async () => {
      conNiveles([N1, N2, N3]);

      await service.reordenarNiveles(BASE_ID, { nivelIds: [N1, N2, N3] });

      expect(ordenesAsignados().map(([, orden]) => orden)).toEqual([0, 1, 2]);
    });

    it('rechaza si falta algún nivel de la base', async () => {
      conNiveles([N1, N2, N3]);

      await expect(
        service.reordenarNiveles(BASE_ID, { nivelIds: [N1, N2] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('rechaza si viene un nivel que no es de esta base', async () => {
      conNiveles([N1, N2]);

      await expect(
        service.reordenarNiveles(BASE_ID, { nivelIds: [N1, N3] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('rechaza ids repetidos', async () => {
      conNiveles([N1, N2]);

      await expect(
        service.reordenarNiveles(BASE_ID, { nivelIds: [N1, N1] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });
});
