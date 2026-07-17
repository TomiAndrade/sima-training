import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ModulosService } from '../modulos/modulos.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PreguntasService } from './preguntas.service';

// PNG mínimo válido (magic bytes reales), para los tests de subida.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const archivo = (buffer: Buffer, size = buffer.length) =>
  ({ buffer, size }) as Express.Multer.File;

const CLAVE = 'preguntas/11111111-2222-4333-8444-555555555555.png';

describe('PreguntasService', () => {
  let service: PreguntasService;
  let prisma: {
    pregunta: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
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
  let storage: {
    guardar: jest.Mock;
    borrar: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      pregunta: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
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
    storage = {
      guardar: jest.fn().mockResolvedValue(CLAVE),
      borrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreguntasService,
        { provide: PrismaService, useValue: prisma },
        { provide: ModulosService, useValue: modulos },
        { provide: StorageService, useValue: storage },
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
    modulos.versionesVigentesDe.mockResolvedValue([
      { id: 'v1', moduloId: 'm1' },
    ]);
    prisma.pregunta.findMany.mockResolvedValue([{ id: 'p1' }]);
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      {
        preguntaId: 'p1',
        moduloVersionId: 'v1',
        activa: true,
        moduloVersion: {
          estado: 'ACTIVO',
          modulo: { id: 'm1', nombre: 'Modulo 1' },
        },
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
      where: {
        preguntaId: '1',
        moduloVersion: { estado: { not: 'ARCHIVADO' } },
      },
      data: { activa: false },
    });
  });

  describe('subirImagen', () => {
    it('guarda la imagen bajo la carpeta preguntas y devuelve la clave', async () => {
      await expect(service.subirImagen(archivo(PNG))).resolves.toEqual({
        imagen: CLAVE,
      });
      expect(storage.guardar).toHaveBeenCalledWith(PNG, 'preguntas', 'png');
    });

    it('rechaza si no vino ningún archivo', async () => {
      await expect(service.subirImagen(undefined)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(storage.guardar).not.toHaveBeenCalled();
    });

    it('rechaza un archivo que no es imagen aunque se llame .png', async () => {
      await expect(
        service.subirImagen(archivo(Buffer.from('no soy una imagen'))),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.guardar).not.toHaveBeenCalled();
    });

    it('rechaza una imagen que supera el máximo', async () => {
      await expect(
        service.subirImagen(archivo(PNG, 3 * 1024 * 1024)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.guardar).not.toHaveBeenCalled();
    });
  });

  describe('borrarImagen', () => {
    it('borra una imagen huérfana', async () => {
      prisma.pregunta.count.mockResolvedValue(0);
      await expect(service.borrarImagen(CLAVE)).resolves.toEqual({
        borrada: true,
      });
      expect(storage.borrar).toHaveBeenCalledWith(CLAVE);
    });

    it('rechaza borrar una imagen ya usada por una pregunta (409)', async () => {
      prisma.pregunta.count.mockResolvedValue(1);
      await expect(service.borrarImagen(CLAVE)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(storage.borrar).not.toHaveBeenCalled();
    });

    it.each([
      ['../../.env', 'path traversal'],
      ['preguntas/../../.env', 'traversal con prefijo válido'],
      ['otra-carpeta/11111111-2222-4333-8444-555555555555.png', 'otra carpeta'],
      ['preguntas/no-es-un-uuid.png', 'nombre arbitrario'],
      [
        'preguntas/11111111-2222-4333-8444-555555555555.exe',
        'extensión no permitida',
      ],
    ])('rechaza una clave inválida: %s (%s)', async (clave) => {
      await expect(service.borrarImagen(clave)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(storage.borrar).not.toHaveBeenCalled();
    });
  });
});
