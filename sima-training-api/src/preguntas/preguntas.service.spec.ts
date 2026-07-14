import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ModulosService } from '../modulos/modulos.service';
import { PrismaService } from '../prisma/prisma.service';
import { PreguntasService } from './preguntas.service';

describe('PreguntasService', () => {
  let service: PreguntasService;
  let prisma: {
    pregunta: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    moduloVersionPregunta: {
      updateMany: jest.Mock;
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let modulos: {
    findAll: jest.Mock;
    versionesVigentesDe: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      pregunta: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      moduloVersionPregunta: {
        updateMany: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };
    modulos = {
      findAll: jest.fn().mockResolvedValue([]),
      versionesVigentesDe: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreguntasService,
        { provide: PrismaService, useValue: prisma },
        { provide: ModulosService, useValue: modulos },
      ],
    }).compile();

    service = module.get(PreguntasService);
  });

  it('crea una pregunta truefalse sin etiquetas', async () => {
    prisma.pregunta.create.mockResolvedValue({ id: '1' });
    await service.create({
      texto: '¿El casco es obligatorio?',
      tipo: 'VERDADERO_FALSO' as any,
      respuestaCorrecta: 'Verdadero',
    });
    expect(prisma.pregunta.create).toHaveBeenCalled();
  });

  it('filtra por texto (?q=) y arma el where con contains insensitive', async () => {
    prisma.pregunta.findMany.mockResolvedValue([]);
    await service.findAll({ q: 'casco' });
    expect(prisma.pregunta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { texto: { contains: 'casco', mode: 'insensitive' } },
      }),
    );
  });

  it('findOne lanza NotFound si no existe', async () => {
    prisma.pregunta.findUnique.mockResolvedValue(null);
    await expect(service.findOne('inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findAll enriquece modulos[] con estadoModulo y totalActivasEnModulo', async () => {
    modulos.findAll.mockResolvedValue([{ id: 'm1' }]);
    modulos.versionesVigentesDe.mockResolvedValue([{ id: 'v1', moduloId: 'm1' }]);
    prisma.pregunta.findMany.mockResolvedValue([{ id: 'p1' }]);
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      {
        preguntaId: 'p1',
        moduloVersionId: 'v1',
        activa: true,
        moduloVersion: { estado: 'ACTIVO', modulo: { id: 'm1', nombre: 'Modulo 1' } },
      },
    ]);
    prisma.moduloVersionPregunta.groupBy.mockResolvedValue([
      { moduloVersionId: 'v1', _count: { _all: 1 } },
    ]);

    const [pregunta] = await service.findAll({});

    expect(pregunta.modulos).toEqual([
      {
        moduloId: 'm1',
        moduloNombre: 'Modulo 1',
        activaEnModulo: true,
        estadoModulo: 'ACTIVO',
        totalActivasEnModulo: 1,
      },
    ]);
  });

  it('setActiva(false) cascadea solo a pivots BORRADOR/ACTIVO, nunca ARCHIVADO', async () => {
    prisma.pregunta.findUnique.mockResolvedValue({ id: '1' });
    prisma.pregunta.update.mockResolvedValue({ id: '1', activa: false });
    await service.setActiva('1', false);
    expect(prisma.moduloVersionPregunta.updateMany).toHaveBeenCalledWith({
      where: { preguntaId: '1', moduloVersion: { estado: { not: 'ARCHIVADO' } } },
      data: { activa: false },
    });
  });
});
