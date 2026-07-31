import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
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
    baseConocimiento: {
      findUnique: jest.Mock;
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
      baseConocimiento: {
        findUnique: jest.fn(),
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

  it('crea una pregunta truefalse', async () => {
    prisma.pregunta.create.mockResolvedValue({ id: '1' });
    await service.create({
      texto: '¿El casco es obligatorio?',
      tipo: 'VERDADERO_FALSO' as any,
      respuestaCorrecta: 'Verdadero',
    });
    expect(prisma.pregunta.create).toHaveBeenCalled();
  });

  describe('validación de opciones al crear', () => {
    const opcionesImagen = {
      texto: '¿Cuál es el tacho correcto?',
      tipo: 'OPCIONES_IMAGEN' as any,
      opciones: [CLAVE, 'preguntas/22222222-3333-4444-8555-666666666666.png'],
    };

    it('acepta una pregunta con opciones y respuestaCorrecta consistente', async () => {
      prisma.pregunta.create.mockResolvedValue({ id: '1' });
      await service.create({ ...opcionesImagen, respuestaCorrecta: CLAVE });
      expect(prisma.pregunta.create).toHaveBeenCalled();
    });

    it('rechaza un tipo con opciones que trae menos de 2', async () => {
      await expect(
        service.create({ ...opcionesImagen, opciones: [CLAVE] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.pregunta.create).not.toHaveBeenCalled();
    });

    it('rechaza un tipo con opciones que no trae ninguna', async () => {
      await expect(
        service.create({ texto: '¿?', tipo: 'OPCION_MULTIPLE' as any }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza una respuestaCorrecta que no está entre las opciones', async () => {
      await expect(
        service.create({
          ...opcionesImagen,
          respuestaCorrecta:
            'preguntas/99999999-9999-4999-8999-999999999999.png',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.pregunta.create).not.toHaveBeenCalled();
    });

    it('permite omitir respuestaCorrecta', async () => {
      prisma.pregunta.create.mockResolvedValue({ id: '1' });
      await service.create(opcionesImagen);
      expect(prisma.pregunta.create).toHaveBeenCalled();
    });

    it('no exige opciones en los tipos que no las usan', async () => {
      prisma.pregunta.create.mockResolvedValue({ id: '1' });
      await service.create({
        texto: '¿El casco es obligatorio?',
        tipo: 'VERDADERO_FALSO' as any,
        respuestaCorrecta: 'Verdadero',
      });
      expect(prisma.pregunta.create).toHaveBeenCalled();
    });
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

    it('busca la clave tanto en el enunciado como en las opciones', async () => {
      // Una imagen de opción vive dentro del jsonb `opciones`, no en la columna
      // `imagen`: si el where mirara solo la columna, se podría borrar una
      // imagen en uso y romper la pregunta en silencio.
      prisma.pregunta.count.mockResolvedValue(0);
      await service.borrarImagen(CLAVE);
      expect(prisma.pregunta.count).toHaveBeenCalledWith({
        where: {
          OR: [{ imagen: CLAVE }, { opciones: { array_contains: CLAVE } }],
        },
      });
    });

    it('rechaza borrar una imagen usada como opción (409)', async () => {
      prisma.pregunta.count.mockResolvedValue(1);
      await expect(service.borrarImagen(CLAVE)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(storage.borrar).not.toHaveBeenCalled();
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

  describe('clasificación', () => {
    const BASE_ID = '11111111-1111-4111-8111-111111111111';

    // La fuente se congela al crear. Si se resolviera en cada lectura, editar
    // la fuente de la base al salir un manual nuevo haría que las preguntas
    // viejas —las que ese manual dejó obsoletas— pasen a citar el manual nuevo.
    it('copia la fuente de la base cuando el alta no trae una', async () => {
      prisma.baseConocimiento.findUnique.mockResolvedValue({
        fuente: 'Manual de Residuos Rev. 4',
      });
      prisma.pregunta.create.mockResolvedValue({ id: 'p1' });

      await service.create({
        texto: '¿En qué tacho van los biodegradables?',
        tipo: 'VERDADERO_FALSO',
        baseConocimientoId: BASE_ID,
      });

      expect(prisma.pregunta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fuente: 'Manual de Residuos Rev. 4',
          }),
        }),
      );
    });

    it('respeta la fuente explícita del alta por sobre la de la base', async () => {
      prisma.baseConocimiento.findUnique.mockResolvedValue({
        fuente: 'la de la base',
      });
      prisma.pregunta.create.mockResolvedValue({ id: 'p1' });

      await service.create({
        texto: 'x',
        tipo: 'VERDADERO_FALSO',
        baseConocimientoId: BASE_ID,
        fuente: 'la explícita',
      });

      expect(prisma.pregunta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fuente: 'la explícita' }),
        }),
      );
    });

    it('no consulta la base si el alta no trae baseConocimientoId', async () => {
      prisma.pregunta.create.mockResolvedValue({ id: 'p1' });

      await service.create({ texto: 'x', tipo: 'VERDADERO_FALSO' });

      expect(prisma.baseConocimiento.findUnique).not.toHaveBeenCalled();
    });

    // La base de datos es la que garantiza la coherencia; el service sólo tiene
    // que traducir el rechazo a 400 en vez de dejar salir un 500.
    it('traduce el rechazo de la FK compuesta (P2003) a 400', async () => {
      const err = new Prisma.PrismaClientKnownRequestError('fk', {
        code: 'P2003',
        clientVersion: 'x',
      });
      prisma.pregunta.create.mockRejectedValue(err);

      await expect(
        service.create({
          texto: 'x',
          tipo: 'VERDADERO_FALSO',
          baseConocimientoId: BASE_ID,
          nivelId: '22222222-2222-4222-8222-222222222222',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('traduce el rechazo del CHECK (nivel sin base) a 400', async () => {
      const err = new Prisma.PrismaClientUnknownRequestError(
        'violates check constraint "preguntas_nivel_requiere_base"',
        { clientVersion: 'x' },
      );
      prisma.pregunta.create.mockRejectedValue(err);

      await expect(
        service.create({
          texto: 'x',
          tipo: 'VERDADERO_FALSO',
          nivelId: '22222222-2222-4222-8222-222222222222',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('?sinBase=true filtra las preguntas sin clasificar', async () => {
      prisma.pregunta.findMany.mockResolvedValue([]);
      prisma.moduloVersionPregunta.findMany.mockResolvedValue([]);

      await service.findAll({ sinBase: true });

      expect(prisma.pregunta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ baseConocimientoId: null }),
        }),
      );
    });

    it('?baseId= y ?nivelId= se combinan con AND', async () => {
      prisma.pregunta.findMany.mockResolvedValue([]);
      prisma.moduloVersionPregunta.findMany.mockResolvedValue([]);

      await service.findAll({ baseId: BASE_ID, nivelId: 'n1' });

      expect(prisma.pregunta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            baseConocimientoId: BASE_ID,
            nivelId: 'n1',
          }),
        }),
      );
    });
  });
});
