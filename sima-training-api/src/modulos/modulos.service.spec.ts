import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ModulosService } from './modulos.service';

describe('ModulosService', () => {
  let service: ModulosService;
  let prisma: {
    modulo: { create: jest.Mock; findUnique: jest.Mock };
    moduloVersion: { findFirst: jest.Mock; findMany: jest.Mock };
    moduloVersionPregunta: { createMany: jest.Mock; findMany: jest.Mock };
    pregunta: { count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      modulo: { create: jest.fn(), findUnique: jest.fn() },
      moduloVersion: { findFirst: jest.fn(), findMany: jest.fn() },
      moduloVersionPregunta: { createMany: jest.fn(), findMany: jest.fn() },
      pregunta: { count: jest.fn() },
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

  it('findOne lanza NotFound si el módulo no existe', async () => {
    prisma.modulo.findUnique.mockResolvedValue(null);
    await expect(service.findOne('inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
