import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ReglasAsignacionService } from './reglas-asignacion.service';

// Regla por par exacto (puesto + centro).
const dto = {
  puestoId: 'p-soldador',
  centroCostoId: 'c-ypf',
  moduloId: 'm1',
};

// Regla de CENTRO: sin puesto, aplica a todos los puestos del centro.
const dtoCentro = {
  centroCostoId: 'c-taller',
  moduloId: 'm-basico',
};

describe('ReglasAsignacionService', () => {
  let service: ReglasAsignacionService;
  let prisma: {
    reglaAsignacion: {
      findFirst: jest.Mock;
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
        findFirst: jest.fn(),
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
    prisma.reglaAsignacion.findFirst.mockResolvedValue(null);
    prisma.reglaAsignacion.create.mockResolvedValue({ id: 'r1', ...dto });

    await service.create(dto);

    expect(prisma.reglaAsignacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ...dto, createdBy: 'backoffice' }),
    });
  });

  it('reactiva la regla existente en vez de duplicar el triple', async () => {
    prisma.reglaAsignacion.findFirst.mockResolvedValue({
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

  // --- Reglas a NIVEL CENTRO DE COSTO (sin puesto) ------------------------

  it('crea una regla de centro con puestoId null y sin validar puesto', async () => {
    prisma.reglaAsignacion.findFirst.mockResolvedValue(null);
    prisma.reglaAsignacion.create.mockResolvedValue({ id: 'r2', ...dtoCentro });

    await service.create(dtoCentro);

    // No hay puesto que validar: ni se consulta el catálogo.
    expect(prisma.puesto.findUnique).not.toHaveBeenCalled();
    expect(prisma.reglaAsignacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ...dtoCentro, puestoId: null }),
    });
  });

  it('busca la regla de centro por puestoId null, no por undefined', async () => {
    // Es lo que evita que reactive una regla de PAR cualquiera del mismo
    // centro+módulo: con undefined Prisma omitiría la condición.
    prisma.reglaAsignacion.findFirst.mockResolvedValue(null);
    prisma.reglaAsignacion.create.mockResolvedValue({ id: 'r2' });

    await service.create(dtoCentro);

    expect(prisma.reglaAsignacion.findFirst).toHaveBeenCalledWith({
      where: { puestoId: null, ...dtoCentro },
    });
  });

  it('reactiva una regla de centro dada de baja en vez de duplicarla', async () => {
    prisma.reglaAsignacion.findFirst.mockResolvedValue({
      id: 'r2',
      activo: false,
    });
    prisma.reglaAsignacion.update.mockResolvedValue({ id: 'r2', activo: true });

    await service.create(dtoCentro);

    expect(prisma.reglaAsignacion.create).not.toHaveBeenCalled();
    expect(prisma.reglaAsignacion.update).toHaveBeenCalledWith({
      where: { id: 'r2' },
      data: expect.objectContaining({ activo: true }),
    });
  });

  it('?alcance=CENTRO trae solo las reglas sin puesto', async () => {
    prisma.reglaAsignacion.findMany.mockResolvedValue([]);

    await service.findAll({ alcance: 'CENTRO' });

    expect(prisma.reglaAsignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: { puestoId: null } } }),
    );
  });

  it('?alcance=PUESTO trae solo las reglas por par exacto', async () => {
    prisma.reglaAsignacion.findMany.mockResolvedValue([]);

    await service.findAll({ alcance: 'PUESTO' });

    expect(prisma.reglaAsignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { AND: { puestoId: { not: null } } } }),
    );
  });

  it('?puestoId= y ?alcance=CENTRO no se pisan: quedan como condiciones contradictorias', async () => {
    // El alcance va en un AND, así que NO sobreescribe el filtro de puesto.
    prisma.reglaAsignacion.findMany.mockResolvedValue([]);

    await service.findAll({ puestoId: 'p-soldador', alcance: 'CENTRO' });

    expect(prisma.reglaAsignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { puestoId: 'p-soldador', AND: { puestoId: null } },
      }),
    );
  });
});
