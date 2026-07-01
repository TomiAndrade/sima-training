import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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

  beforeEach(async () => {
    prisma = {
      pregunta: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreguntasService,
        { provide: PrismaService, useValue: prisma },
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
