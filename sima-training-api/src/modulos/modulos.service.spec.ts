import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ModulosService } from './modulos.service';

describe('ModulosService', () => {
  let service: ModulosService;
  let prisma: {
    modulo: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    moduloVersion: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      aggregate: jest.Mock;
    };
    moduloVersionPregunta: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      aggregate: jest.Mock;
    };
    pregunta: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      modulo: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      moduloVersion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { numeroVersion: 0, mayor: 0 } }),
      },
      moduloVersionPregunta: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { orden: 0 } }),
      },
      pregunta: { count: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ModulosService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ModulosService);
  });

  it('crea el módulo con su versión 1 en BORRADOR', async () => {
    prisma.modulo.create.mockResolvedValue({
      id: 'm1',
      versiones: [{ id: 'v1', numeroVersion: 1, estado: 'BORRADOR' }],
    });
    await service.create({ nombre: 'SIMA Básico' });
    expect(prisma.modulo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versiones: { create: { numeroVersion: 1 } },
        }),
      }),
    );
  });

  it('asignarPreguntas rechaza si no hay versión en BORRADOR', async () => {
    prisma.moduloVersion.findFirst.mockResolvedValue(null);
    await expect(
      service.asignarPreguntas('m1', [{ preguntaId: 'p1', orden: 1 }]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('asignarPreguntas rechaza si alguna pregunta no existe', async () => {
    prisma.moduloVersion.findFirst.mockResolvedValue({ id: 'v1' });
    prisma.pregunta.count.mockResolvedValue(0);
    await expect(
      service.asignarPreguntas('m1', [{ preguntaId: 'p1', orden: 1 }]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('asignarPreguntas crea las filas de pivot para la versión BORRADOR', async () => {
    prisma.moduloVersion.findFirst.mockResolvedValue({ id: 'v1' });
    prisma.pregunta.count.mockResolvedValue(1);
    prisma.moduloVersionPregunta.createMany.mockResolvedValue({ count: 1 });
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      { preguntaId: 'p1' },
    ]);

    await service.asignarPreguntas('m1', [
      { preguntaId: 'p1', orden: 1, obligatoria: false },
    ]);

    expect(prisma.moduloVersionPregunta.createMany).toHaveBeenCalledWith({
      data: [
        {
          moduloVersionId: 'v1',
          preguntaId: 'p1',
          orden: 1,
          obligatoria: false,
        },
      ],
    });
  });

  it('asignarPreguntas appendea el orden cuando no viene explícito', async () => {
    prisma.moduloVersion.findFirst.mockResolvedValue({ id: 'v1' });
    prisma.pregunta.count.mockResolvedValue(2);
    prisma.moduloVersionPregunta.aggregate.mockResolvedValue({
      _max: { orden: 5 },
    });
    prisma.moduloVersionPregunta.createMany.mockResolvedValue({ count: 2 });
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([]);

    await service.asignarPreguntas('m1', [
      { preguntaId: 'p1' },
      { preguntaId: 'p2' },
    ]);

    expect(prisma.moduloVersionPregunta.createMany).toHaveBeenCalledWith({
      data: [
        { moduloVersionId: 'v1', preguntaId: 'p1', orden: 6, obligatoria: true },
        { moduloVersionId: 'v1', preguntaId: 'p2', orden: 7, obligatoria: true },
      ],
    });
  });

  it('findOne lanza NotFound si el módulo no existe', async () => {
    prisma.modulo.findUnique.mockResolvedValue(null);
    await expect(service.findOne('inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update edita nombre/descripcion del módulo', async () => {
    prisma.modulo.update.mockResolvedValue({ id: 'm1', nombre: 'Nuevo' });
    await service.update('m1', { nombre: 'Nuevo' });
    expect(prisma.modulo.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { nombre: 'Nuevo' },
    });
  });

  it('crearVersion rechaza si ya hay un borrador en curso', async () => {
    prisma.modulo.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : null,
    );
    await expect(service.crearVersion('m1', false)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('crearVersion rechaza si no hay versión activa de la cual partir', async () => {
    prisma.modulo.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.moduloVersion.findFirst.mockResolvedValue(null);
    await expect(service.crearVersion('m1', false)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('crearVersion copia los pivots del ACTIVO al nuevo borrador', async () => {
    prisma.modulo.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? null : { id: 'v-activo' },
    );
    prisma.moduloVersion.aggregate.mockResolvedValue({
      _max: { numeroVersion: 2 },
    });
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      { preguntaId: 'p1', orden: 1, obligatoria: true, activa: true },
    ]);
    prisma.moduloVersion.create.mockResolvedValue({
      id: 'v-borrador-nuevo',
      numeroVersion: 3,
      estado: 'BORRADOR',
    });

    await service.crearVersion('m1', true);

    expect(prisma.moduloVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          moduloId: 'm1',
          numeroVersion: 3,
          estado: 'BORRADOR',
          esNuevaLinea: true,
          preguntas: {
            create: [{ preguntaId: 'p1', orden: 1, obligatoria: true, activa: true }],
          },
        }),
      }),
    );
  });

  it('activar rechaza si no hay borrador', async () => {
    prisma.moduloVersion.findFirst.mockResolvedValue(null);
    await expect(service.activar('m1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('activar numera la primera publicación como AÑO.01.00', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador', esNuevaLinea: null } : null,
    );
    prisma.moduloVersion.aggregate.mockResolvedValue({ _max: { mayor: 0 } });
    prisma.moduloVersion.update.mockResolvedValue({ id: 'v-borrador', estado: 'ACTIVO' });

    const anioActual = new Date().getFullYear();
    await service.activar('m1');

    expect(prisma.moduloVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-borrador' },
      data: expect.objectContaining({
        estado: 'ACTIVO',
        anio: anioActual,
        mayor: 1,
        menor: 0,
      }),
    });
  });

  it('activar como actualización (menor) sube el menor y archiva el ACTIVO previo', async () => {
    const activo = { id: 'v-activo', anio: 2026, mayor: 1, menor: 0 };
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR'
        ? { id: 'v-borrador', esNuevaLinea: false }
        : activo,
    );
    prisma.moduloVersion.update.mockResolvedValue({ id: 'v-borrador', estado: 'ACTIVO' });

    await service.activar('m1');

    expect(prisma.moduloVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-activo' },
      data: { estado: 'ARCHIVADO' },
    });
    expect(prisma.moduloVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-borrador' },
      data: expect.objectContaining({ anio: 2026, mayor: 1, menor: 1 }),
    });
  });

  it('activar como versión nueva (mayor) sube el mayor y resetea el menor', async () => {
    const activo = { id: 'v-activo', anio: 2026, mayor: 1, menor: 3 };
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR'
        ? { id: 'v-borrador', esNuevaLinea: true }
        : activo,
    );
    prisma.moduloVersion.aggregate.mockResolvedValue({ _max: { mayor: 1 } });
    prisma.moduloVersion.update.mockResolvedValue({ id: 'v-borrador', estado: 'ACTIVO' });

    const anioActual = new Date().getFullYear();
    await service.activar('m1');

    expect(prisma.moduloVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-borrador' },
      data: expect.objectContaining({ anio: anioActual, mayor: 2, menor: 0 }),
    });
  });

  it('findVersiones aplana _count.preguntas a preguntasCount', async () => {
    prisma.moduloVersion.findMany.mockResolvedValue([
      { id: 'v1', numeroVersion: 1, estado: 'ARCHIVADO', _count: { preguntas: 3 } },
      { id: 'v2', numeroVersion: 2, estado: 'ACTIVO', _count: { preguntas: 5 } },
    ]);

    const result = await service.findVersiones('m1');

    expect(result).toEqual([
      { id: 'v1', numeroVersion: 1, estado: 'ARCHIVADO', preguntasCount: 3 },
      { id: 'v2', numeroVersion: 2, estado: 'ACTIVO', preguntasCount: 5 },
    ]);
  });
});
