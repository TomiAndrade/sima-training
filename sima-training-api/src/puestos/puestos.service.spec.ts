import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PuestosService } from './puestos.service';

describe('PuestosService', () => {
  let service: PuestosService;
  let prisma: {
    puesto: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      puesto: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PuestosService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PuestosService);
  });

  it('crea un puesto con nombre libre', async () => {
    prisma.puesto.findUnique.mockResolvedValue(null);
    prisma.puesto.create.mockResolvedValue({ id: '1' });
    await service.create({ nombre: 'Soldador' });
    expect(prisma.puesto.create).toHaveBeenCalled();
  });

  it('rechaza nombre duplicado (409)', async () => {
    prisma.puesto.findUnique.mockResolvedValue({ id: '1', nombre: 'Soldador' });
    await expect(service.create({ nombre: 'Soldador' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('update lanza NotFound si no existe', async () => {
    prisma.puesto.findUnique.mockResolvedValue(null);
    await expect(
      service.update('999', { nombre: 'Otro' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update permite togglear activo', async () => {
    prisma.puesto.findUnique.mockResolvedValue({ id: '1', nombre: 'Soldador' });
    prisma.puesto.update.mockResolvedValue({ id: '1', activo: false });
    await service.update('1', { activo: false });
    expect(prisma.puesto.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { activo: false },
    });
  });
});
