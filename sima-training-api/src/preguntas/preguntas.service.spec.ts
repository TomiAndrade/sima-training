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
    };
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
      },
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
});
