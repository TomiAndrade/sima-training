import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EtiquetasService } from './etiquetas.service';

describe('EtiquetasService', () => {
  let service: EtiquetasService;
  let prisma: {
    etiqueta: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      etiqueta: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtiquetasService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(EtiquetasService);
  });

  it('crea una etiqueta con nombre libre', async () => {
    prisma.etiqueta.findUnique.mockResolvedValue(null);
    prisma.etiqueta.create.mockResolvedValue({ id: '1' });
    await service.create({ nombre: 'LOTO', categoria: 'TEMA' as any });
    expect(prisma.etiqueta.create).toHaveBeenCalled();
  });

  it('rechaza nombre duplicado (409)', async () => {
    prisma.etiqueta.findUnique.mockResolvedValue({ id: '1', nombre: 'LOTO' });
    await expect(
      service.create({ nombre: 'LOTO', categoria: 'TEMA' as any }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
