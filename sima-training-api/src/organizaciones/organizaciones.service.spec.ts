import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizacionesService } from './organizaciones.service';

describe('OrganizacionesService', () => {
  let service: OrganizacionesService;
  let prisma: {
    organizacion: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      organizacion: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizacionesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(OrganizacionesService);
  });

  it('crea un cliente sin padre', async () => {
    prisma.organizacion.create.mockResolvedValue({ id: 1 });
    await service.create({ nombre: 'YPF' });
    expect(prisma.organizacion.create).toHaveBeenCalled();
  });

  it('rechaza crear con padre inexistente', async () => {
    prisma.organizacion.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ nombre: 'Sub', organizacionPadreId: 999 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findOne lanza NotFound si no existe', async () => {
    prisma.organizacion.findUnique.mockResolvedValue(null);
    await expect(service.findOne(42)).rejects.toBeInstanceOf(NotFoundException);
  });
});
