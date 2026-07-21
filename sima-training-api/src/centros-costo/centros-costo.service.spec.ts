import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CentrosCostoService } from './centros-costo.service';

describe('CentrosCostoService', () => {
  let service: CentrosCostoService;
  let prisma: {
    centroCosto: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      centroCosto: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CentrosCostoService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CentrosCostoService);
  });

  it('crea un centro de costo con nombre libre', async () => {
    prisma.centroCosto.findUnique.mockResolvedValue(null);
    prisma.centroCosto.create.mockResolvedValue({ id: '1' });
    await service.create({ nombre: 'Planta Norte' });
    expect(prisma.centroCosto.create).toHaveBeenCalled();
  });

  it('rechaza nombre duplicado (409)', async () => {
    prisma.centroCosto.findUnique.mockResolvedValue({
      id: '1',
      nombre: 'Planta Norte',
    });
    await expect(
      service.create({ nombre: 'Planta Norte' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('update lanza NotFound si no existe', async () => {
    prisma.centroCosto.findUnique.mockResolvedValue(null);
    await expect(
      service.update('999', { nombre: 'Otro' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update permite togglear activo', async () => {
    prisma.centroCosto.findUnique.mockResolvedValue({
      id: '1',
      nombre: 'Planta Norte',
    });
    prisma.centroCosto.update.mockResolvedValue({ id: '1', activo: false });
    await service.update('1', { activo: false });
    expect(prisma.centroCosto.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { activo: false },
    });
  });
});
