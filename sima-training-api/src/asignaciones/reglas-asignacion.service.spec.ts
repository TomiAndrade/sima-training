import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ReglasAsignacionService } from './reglas-asignacion.service';

const dto = {
  puestoId: 'p-soldador',
  centroCostoId: 'c-ypf',
  moduloId: 'm1',
};

describe('ReglasAsignacionService', () => {
  let service: ReglasAsignacionService;
  let prisma: {
    reglaAsignacion: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    puesto: { findUnique: jest.Mock };
    centroCosto: { findUnique: jest.Mock };
    modulo: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      reglaAsignacion: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      puesto: { findUnique: jest.fn() },
      centroCosto: { findUnique: jest.fn() },
      modulo: { findUnique: jest.fn() },
    };
    // Por defecto las tres referencias existen.
    prisma.puesto.findUnique.mockResolvedValue({ id: dto.puestoId });
    prisma.centroCosto.findUnique.mockResolvedValue({ id: dto.centroCostoId });
    prisma.modulo.findUnique.mockResolvedValue({ id: dto.moduloId });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReglasAsignacionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ReglasAsignacionService);
  });

  it('crea la regla cuando el triple no existe todavía', async () => {
    prisma.reglaAsignacion.findUnique.mockResolvedValue(null);
    prisma.reglaAsignacion.create.mockResolvedValue({ id: 'r1', ...dto });

    await service.create(dto);

    expect(prisma.reglaAsignacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ...dto, createdBy: 'backoffice' }),
    });
  });

  it('reactiva la regla existente en vez de duplicar el triple', async () => {
    prisma.reglaAsignacion.findUnique.mockResolvedValue({
      id: 'r1',
      activo: false,
    });
    prisma.reglaAsignacion.update.mockResolvedValue({ id: 'r1', activo: true });

    await service.create(dto);

    expect(prisma.reglaAsignacion.create).not.toHaveBeenCalled();
    expect(prisma.reglaAsignacion.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ activo: true }),
    });
  });

  it('rechaza el alta si el módulo no existe (400, no error de FK)', async () => {
    prisma.modulo.findUnique.mockResolvedValue(null);
    await expect(service.create(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.reglaAsignacion.create).not.toHaveBeenCalled();
  });

  it('filtra el listado solo por lo que viene', async () => {
    prisma.reglaAsignacion.findMany.mockResolvedValue([]);

    await service.findAll({ puestoId: 'p-soldador', activo: true });

    expect(prisma.reglaAsignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { puestoId: 'p-soldador', activo: true },
      }),
    );
  });
});
