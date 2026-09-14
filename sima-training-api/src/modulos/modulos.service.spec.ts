import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolUsuario } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ModulosService } from './modulos.service';

describe('ModulosService', () => {
  let service: ModulosService;
  let prisma: {
    modulo: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    moduloVersion: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      aggregate: jest.Mock;
      delete: jest.Mock;
    };
    moduloVersionPregunta: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      aggregate: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
      delete: jest.Mock;
    };
    moduloVersionCriterio: {
      findMany: jest.Mock;
      createMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    pregunta: { count: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let audit: { registrar: jest.Mock };

  beforeEach(async () => {
    prisma = {
      modulo: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      moduloVersion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _max: { numeroVersion: 0, mayor: 0 } }),
        delete: jest.fn(),
      },
      moduloVersionPregunta: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        // Default: el pivot existe y es MANUAL (el caso que unassignPregunta
        // siempre pudo borrar). Los specs que ejercitan CRITERIO lo pisan.
        findUnique: jest.fn().mockResolvedValue({ origen: 'MANUAL' }),
        aggregate: jest.fn().mockResolvedValue({ _max: { orden: 0 } }),
        update: jest.fn(),
        deleteMany: jest.fn(),
        delete: jest.fn(),
      },
      moduloVersionCriterio: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      pregunta: {
        count: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModulosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
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
        {
          moduloVersionId: 'v1',
          preguntaId: 'p1',
          orden: 6,
          obligatoria: true,
        },
        {
          moduloVersionId: 'v1',
          preguntaId: 'p2',
          orden: 7,
          obligatoria: true,
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

  it('update edita nombre/descripcion del módulo', async () => {
    prisma.modulo.findUnique.mockResolvedValue({ id: 'm1', nombre: 'Viejo' });
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
    await expect(service.crearVersion('m1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('crearVersion rechaza si no hay versión activa de la cual partir', async () => {
    prisma.modulo.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.moduloVersion.findFirst.mockResolvedValue(null);
    await expect(service.crearVersion('m1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('crearVersion copia los pivots del ACTIVO al nuevo borrador sin pedir esNuevaLinea', async () => {
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

    await service.crearVersion('m1');

    const dataCreada = prisma.moduloVersion.create.mock.calls[0][0].data;
    expect(dataCreada).toEqual(
      expect.objectContaining({
        moduloId: 'm1',
        numeroVersion: 3,
        estado: 'BORRADOR',
        preguntas: {
          create: [
            { preguntaId: 'p1', orden: 1, obligatoria: true, activa: true },
          ],
        },
      }),
    );
    expect(dataCreada.esNuevaLinea).toBeUndefined();
  });

  it('activar rechaza si no hay borrador', async () => {
    prisma.moduloVersion.findFirst.mockResolvedValue(null);
    await expect(service.activar('m1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('activar rechaza si hay un ACTIVO publicado y no se eligió esNuevaLinea', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : { id: 'v-activo' },
    );
    await expect(service.activar('m1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.moduloVersion.update).not.toHaveBeenCalled();
  });

  it('activar numera la primera publicación como AÑO.01.00 sin pedir esNuevaLinea', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : null,
    );
    prisma.moduloVersion.aggregate.mockResolvedValue({ _max: { mayor: 0 } });
    prisma.moduloVersion.update.mockResolvedValue({
      id: 'v-borrador',
      estado: 'ACTIVO',
    });

    const anioActual = new Date().getFullYear();
    await service.activar('m1');

    expect(prisma.moduloVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-borrador' },
      data: expect.objectContaining({
        estado: 'ACTIVO',
        esNuevaLinea: null,
        anio: anioActual,
        mayor: 1,
        menor: 0,
      }),
    });
  });

  it('activar como actualización (menor) sube el menor y archiva el ACTIVO previo', async () => {
    const activo = { id: 'v-activo', anio: 2026, mayor: 1, menor: 0 };
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : activo,
    );
    prisma.moduloVersion.update.mockResolvedValue({
      id: 'v-borrador',
      estado: 'ACTIVO',
    });

    await service.activar('m1', false);

    expect(prisma.moduloVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-activo' },
      data: { estado: 'ARCHIVADO' },
    });
    expect(prisma.moduloVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-borrador' },
      data: expect.objectContaining({
        esNuevaLinea: false,
        anio: 2026,
        mayor: 1,
        menor: 1,
      }),
    });
  });

  it('activar como versión nueva (mayor) sube el mayor y resetea el menor', async () => {
    const activo = { id: 'v-activo', anio: 2026, mayor: 1, menor: 3 };
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : activo,
    );
    prisma.moduloVersion.aggregate.mockResolvedValue({ _max: { mayor: 1 } });
    prisma.moduloVersion.update.mockResolvedValue({
      id: 'v-borrador',
      estado: 'ACTIVO',
    });

    const anioActual = new Date().getFullYear();
    await service.activar('m1', true);

    expect(prisma.moduloVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-borrador' },
      data: expect.objectContaining({
        esNuevaLinea: true,
        anio: anioActual,
        mayor: 2,
        menor: 0,
      }),
    });
  });

  it('findVersiones aplana _count.preguntas a preguntasCount', async () => {
    prisma.moduloVersion.findMany.mockResolvedValue([
      {
        id: 'v1',
        numeroVersion: 1,
        estado: 'ARCHIVADO',
        _count: { preguntas: 3 },
      },
      {
        id: 'v2',
        numeroVersion: 2,
        estado: 'ACTIVO',
        _count: { preguntas: 5 },
      },
    ]);

    const result = await service.findVersiones('m1');

    expect(result).toEqual([
      { id: 'v1', numeroVersion: 1, estado: 'ARCHIVADO', preguntasCount: 3 },
      { id: 'v2', numeroVersion: 2, estado: 'ACTIVO', preguntasCount: 5 },
    ]);
  });

  it('findOne muestra el BORRADOR en curso, no el ACTIVO, cuando ambos coexisten', async () => {
    prisma.modulo.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : { id: 'v-activo' },
    );
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      { preguntaId: 'p1' },
    ]);

    const result = await service.findOne('m1');

    expect(result.version).toEqual({ id: 'v-borrador' });
    expect(prisma.moduloVersionPregunta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { moduloVersionId: 'v-borrador' } }),
    );
  });

  it('setPreguntaActiva togglea sobre el BORRADOR en curso, no sobre el ACTIVO publicado', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : { id: 'v-activo' },
    );
    prisma.moduloVersionPregunta.update.mockResolvedValue({
      preguntaId: 'p1',
      activa: false,
    });

    await service.setPreguntaActiva('m1', 'p1', false);

    expect(prisma.moduloVersionPregunta.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          moduloVersionId_preguntaId: {
            moduloVersionId: 'v-borrador',
            preguntaId: 'p1',
          },
        },
        data: { activa: false },
      }),
    );
  });

  it('setPreguntaActiva togglea sobre el ACTIVO cuando no hay borrador en curso', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? null : { id: 'v-activo' },
    );
    prisma.moduloVersionPregunta.update.mockResolvedValue({
      preguntaId: 'p1',
      activa: false,
    });

    await service.setPreguntaActiva('m1', 'p1', false);

    expect(prisma.moduloVersionPregunta.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          moduloVersionId_preguntaId: {
            moduloVersionId: 'v-activo',
            preguntaId: 'p1',
          },
        },
      }),
    );
  });

  it('setPreguntaActiva(true) rechaza si la pregunta está en la papelera global', async () => {
    prisma.moduloVersion.findFirst.mockResolvedValue({ id: 'v-borrador' });
    prisma.pregunta.findUnique.mockResolvedValue({ id: 'p1', activa: false });

    await expect(
      service.setPreguntaActiva('m1', 'p1', true),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.moduloVersionPregunta.update).not.toHaveBeenCalled();
  });

  it('setPreguntaActiva(true) reactiva el pivot cuando la pregunta no está en papelera', async () => {
    prisma.moduloVersion.findFirst.mockResolvedValue({ id: 'v-borrador' });
    prisma.pregunta.findUnique.mockResolvedValue({ id: 'p1', activa: true });
    prisma.moduloVersionPregunta.update.mockResolvedValue({
      preguntaId: 'p1',
      activa: true,
    });

    await service.setPreguntaActiva('m1', 'p1', true);

    expect(prisma.moduloVersionPregunta.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { activa: true } }),
    );
  });

  it('unassignPregunta rechaza si el módulo no tiene versiones', async () => {
    prisma.moduloVersion.findFirst.mockResolvedValue(null);
    await expect(service.unassignPregunta('m1', 'p1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('unassignPregunta rechaza si la versión vigente no es un BORRADOR', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR'
        ? null
        : where.estado === 'ACTIVO'
          ? { id: 'v-activo', estado: 'ACTIVO' }
          : null,
    );
    await expect(service.unassignPregunta('m1', 'p1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.moduloVersionPregunta.delete).not.toHaveBeenCalled();
  });

  it('unassignPregunta borra el pivot cuando hay un borrador en curso', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR'
        ? { id: 'v-borrador', estado: 'BORRADOR' }
        : null,
    );
    await service.unassignPregunta('m1', 'p1');
    expect(prisma.moduloVersionPregunta.delete).toHaveBeenCalledWith({
      where: {
        moduloVersionId_preguntaId: {
          moduloVersionId: 'v-borrador',
          preguntaId: 'p1',
        },
      },
    });
  });

  it('unassignPregunta rechaza quitar una pregunta que trajo un criterio', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR'
        ? { id: 'v-borrador', estado: 'BORRADOR' }
        : null,
    );
    prisma.moduloVersionPregunta.findUnique.mockResolvedValue({
      origen: 'CRITERIO',
    });

    await expect(service.unassignPregunta('m1', 'p1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.moduloVersionPregunta.delete).not.toHaveBeenCalled();
  });

  it('el rechazo de una CRITERIO explica que "Desactivar" sobrevive a las resoluciones', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR'
        ? { id: 'v-borrador', estado: 'BORRADOR' }
        : null,
    );
    prisma.moduloVersionPregunta.findUnique.mockResolvedValue({
      origen: 'CRITERIO',
    });

    // El mensaje es la única guía que tiene el admin en ese momento: si sólo
    // dijera "editá el criterio", la salida obvia sería borrar el criterio
    // entero y perder todas las demás preguntas que trajo.
    await expect(service.unassignPregunta('m1', 'p1')).rejects.toThrow(
      /Desactivar/,
    );
    await expect(service.unassignPregunta('m1', 'p1')).rejects.toThrow(
      /se mantiene aunque se vuelvan a guardar los criterios/,
    );
  });

  it('unassignPregunta rechaza si la pregunta no está asignada', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR'
        ? { id: 'v-borrador', estado: 'BORRADOR' }
        : null,
    );
    prisma.moduloVersionPregunta.findUnique.mockResolvedValue(null);

    await expect(service.unassignPregunta('m1', 'p1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('crearVersion copia también los criterios del ACTIVO, sin re-resolverlos', async () => {
    prisma.modulo.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? null : { id: 'v-activo' },
    );
    prisma.moduloVersion.aggregate.mockResolvedValue({
      _max: { numeroVersion: 2 },
    });
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      {
        preguntaId: 'p1',
        orden: 1,
        obligatoria: true,
        activa: false,
        origen: 'CRITERIO',
      },
    ]);
    prisma.moduloVersionCriterio.findMany.mockResolvedValue([
      { id: 'c1', baseConocimientoId: 'base-1', nivelId: 'nivel-1' },
    ]);
    prisma.moduloVersion.create.mockResolvedValue({ id: 'v-nueva' });

    await service.crearVersion('m1');

    const data = prisma.moduloVersion.create.mock.calls[0][0].data;
    expect(data.criterios).toEqual({
      create: [
        {
          baseConocimientoId: 'base-1',
          nivelId: 'nivel-1',
          createdBy: 'backoffice',
        },
      ],
    });
    // El pivot se copia con su origen Y con su `activa` — el borrador arranca
    // como la foto exacta de lo publicado, sin volver a resolver el criterio.
    expect(data.preguntas).toEqual({
      create: [
        {
          preguntaId: 'p1',
          orden: 1,
          obligatoria: true,
          activa: false,
          origen: 'CRITERIO',
        },
      ],
    });
    expect(prisma.pregunta.findMany).not.toHaveBeenCalled();
  });

  it('activar no re-resuelve los criterios: publica el snapshot tal cual está', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : null,
    );
    prisma.moduloVersion.aggregate.mockResolvedValue({ _max: { mayor: 0 } });
    prisma.moduloVersion.update.mockResolvedValue({ id: 'v-borrador' });

    await service.activar('m1');

    // Si activar resolviera, el pool publicado podría no ser el que se estuvo
    // viendo en el editor — que es justamente lo que el snapshot evita.
    expect(prisma.pregunta.findMany).not.toHaveBeenCalled();
    expect(prisma.moduloVersionPregunta.createMany).not.toHaveBeenCalled();
    expect(prisma.moduloVersionPregunta.deleteMany).not.toHaveBeenCalled();
  });

  it('cancelarBorrador rechaza si no hay borrador en curso', async () => {
    prisma.moduloVersion.findFirst.mockResolvedValue(null);
    await expect(service.cancelarBorrador('m1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('cancelarBorrador borra el borrador y deja el módulo si hay un ACTIVO', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : { id: 'v-activo' },
    );

    const resultado = await service.cancelarBorrador('m1');

    expect(prisma.moduloVersionPregunta.deleteMany).toHaveBeenCalledWith({
      where: { moduloVersionId: 'v-borrador' },
    });
    // Los criterios cuelgan de la versión con una FK RESTRICT: si no se borran
    // antes, el delete de la versión falla.
    expect(prisma.moduloVersionCriterio.deleteMany).toHaveBeenCalledWith({
      where: { moduloVersionId: 'v-borrador' },
    });
    expect(prisma.moduloVersion.delete).toHaveBeenCalledWith({
      where: { id: 'v-borrador' },
    });
    expect(prisma.modulo.delete).not.toHaveBeenCalled();
    expect(resultado).toEqual({ moduloEliminado: false });
  });

  describe('parámetros de examen', () => {
    const PARAMETROS = {
      preguntasPorExamen: 5,
      umbralAprobacion: 80,
      maxIntentos: 2,
      esperaEntreIntentosMinutos: 60,
    };

    it('create los manda a la v1, no al módulo', async () => {
      prisma.modulo.create.mockResolvedValue({
        id: 'm1',
        versiones: [{ id: 'v1', numeroVersion: 1, estado: 'BORRADOR' }],
      });

      await service.create({ nombre: 'Altura', ...PARAMETROS });

      const { data } = prisma.modulo.create.mock.calls[0][0];
      expect(data.versiones.create).toEqual({
        numeroVersion: 1,
        ...PARAMETROS,
      });
      // Son columnas de modulo_versiones: si se colaran en el spread del módulo,
      // Prisma rechazaría el campo desconocido.
      expect(data).not.toHaveProperty('umbralAprobacion');
      expect(data).not.toHaveProperty('preguntasPorExamen');
    });

    it('crearVersion los hereda del ACTIVO', async () => {
      prisma.modulo.findUnique.mockResolvedValue({ id: 'm1' });
      prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
        where.estado === 'BORRADOR' ? null : { id: 'v-activo', ...PARAMETROS },
      );
      prisma.moduloVersion.aggregate.mockResolvedValue({
        _max: { numeroVersion: 1 },
      });
      prisma.moduloVersionPregunta.findMany.mockResolvedValue([]);
      prisma.moduloVersion.create.mockResolvedValue({ id: 'v-nueva' });

      await service.crearVersion('m1');

      // Sin esto, editar un módulo publicado le resetea el umbral al default
      // global en silencio — el borrador tiene que ser la foto de lo publicado
      // también en cómo se rinde, no sólo en qué preguntas tiene.
      expect(prisma.moduloVersion.create.mock.calls[0][0].data).toMatchObject(
        PARAMETROS,
      );
    });

    it('setParametrosExamen rechaza sobre una versión publicada', async () => {
      prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
        where.estado === 'BORRADOR' ? null : { id: 'v1', estado: 'ACTIVO' },
      );

      await expect(
        service.setParametrosExamen('m1', PARAMETROS),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.moduloVersion.update).not.toHaveBeenCalled();
    });

    it('setParametrosExamen normaliza a null lo que no viene', async () => {
      prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
        where.estado === 'BORRADOR'
          ? { id: 'v-borrador', estado: 'BORRADOR' }
          : null,
      );
      prisma.moduloVersion.update.mockResolvedValue({ id: 'v-borrador' });

      await service.setParametrosExamen('m1', { umbralAprobacion: 90 });

      // Es un PUT: lo omitido vuelve al default global. Con undefined Prisma
      // dropea el campo y el valor viejo sobreviviría a un "borrar" del backoffice.
      expect(prisma.moduloVersion.update).toHaveBeenCalledWith({
        where: { id: 'v-borrador' },
        data: {
          preguntasPorExamen: null,
          umbralAprobacion: 90,
          maxIntentos: null,
          esperaEntreIntentosMinutos: null,
        },
      });
    });
  });

  describe('setCriterios', () => {
    const BASE = 'base-seguridad';
    const NIVEL = 'nivel-basico';

    // Deja el módulo con un BORRADOR en curso (el caso editable).
    const enBorrador = () =>
      prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
        where.estado === 'BORRADOR'
          ? { id: 'v-borrador', estado: 'BORRADOR' }
          : null,
      );

    // Lo que resolverCriterios lee: los criterios guardados, el pool que
    // matchean y los pivots que ya tiene la versión.
    const conEstado = ({
      criterios = [],
      pool = [],
      pivots = [],
    }: {
      criterios?: {
        id: string;
        baseConocimientoId: string;
        nivelId: string | null;
      }[];
      pool?: string[];
      pivots?: { preguntaId: string; origen: string; activa: boolean }[];
    }) => {
      prisma.moduloVersionCriterio.findMany.mockResolvedValue(criterios);
      prisma.pregunta.findMany.mockResolvedValue(pool.map((id) => ({ id })));
      prisma.moduloVersionPregunta.findMany.mockResolvedValue(pivots);
    };

    it('rechaza si la versión que se está editando no es un BORRADOR', async () => {
      prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
        where.estado === 'BORRADOR'
          ? null
          : { id: 'v-activo', estado: 'ACTIVO' },
      );

      await expect(
        service.setCriterios('m1', {
          criterios: [{ baseConocimientoId: BASE }],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.moduloVersionCriterio.createMany).not.toHaveBeenCalled();
    });

    it('rechaza criterios repetidos en el payload, tratando nivel ausente y null como el mismo', async () => {
      enBorrador();

      await expect(
        service.setCriterios('m1', {
          criterios: [
            { baseConocimientoId: BASE },
            { baseConocimientoId: BASE, nivelId: undefined },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.moduloVersionCriterio.deleteMany).not.toHaveBeenCalled();
    });

    it('materializa las preguntas del pool que todavía no están asignadas', async () => {
      enBorrador();
      conEstado({
        criterios: [{ id: 'c1', baseConocimientoId: BASE, nivelId: NIVEL }],
        pool: ['p1', 'p2'],
        pivots: [],
      });
      prisma.moduloVersionPregunta.aggregate.mockResolvedValue({
        _max: { orden: 4 },
      });

      const res = await service.setCriterios('m1', {
        criterios: [{ baseConocimientoId: BASE, nivelId: NIVEL }],
      });

      expect(prisma.moduloVersionPregunta.createMany).toHaveBeenCalledWith({
        data: [
          {
            moduloVersionId: 'v-borrador',
            preguntaId: 'p1',
            orden: 5,
            origen: 'CRITERIO',
          },
          {
            moduloVersionId: 'v-borrador',
            preguntaId: 'p2',
            orden: 6,
            origen: 'CRITERIO',
          },
        ],
      });
      expect(res.resolucion).toEqual(
        expect.objectContaining({ agregadas: 2, quitadas: 0, conservadas: 0 }),
      );
    });

    it('conserva el pivot CRITERIO desactivado a mano si la pregunta sigue matcheando', async () => {
      enBorrador();
      conEstado({
        criterios: [{ id: 'c1', baseConocimientoId: BASE, nivelId: NIVEL }],
        pool: ['p1'],
        pivots: [{ preguntaId: 'p1', origen: 'CRITERIO', activa: false }],
      });

      const res = await service.setCriterios('m1', {
        criterios: [{ baseConocimientoId: BASE, nivelId: NIVEL }],
      });

      expect(prisma.moduloVersionPregunta.createMany).not.toHaveBeenCalled();
      expect(prisma.moduloVersionPregunta.deleteMany).not.toHaveBeenCalled();
      expect(res.resolucion).toEqual(
        expect.objectContaining({ agregadas: 0, quitadas: 0, conservadas: 1 }),
      );
    });

    it('borra el pivot CRITERIO que quedó huérfano, aunque esté desactivado a mano', async () => {
      enBorrador();
      conEstado({
        criterios: [],
        pool: [],
        pivots: [{ preguntaId: 'p1', origen: 'CRITERIO', activa: false }],
      });

      const res = await service.setCriterios('m1', { criterios: [] });

      expect(prisma.moduloVersionPregunta.deleteMany).toHaveBeenCalledWith({
        where: { moduloVersionId: 'v-borrador', preguntaId: { in: ['p1'] } },
      });
      expect(res.resolucion).toEqual(
        expect.objectContaining({ quitadas: 1, conservadas: 0 }),
      );
    });

    it('nunca toca los pivots MANUAL: no los borra al sacar el criterio', async () => {
      enBorrador();
      conEstado({
        criterios: [],
        pool: [],
        pivots: [
          { preguntaId: 'p-manual', origen: 'MANUAL', activa: true },
          { preguntaId: 'p-criterio', origen: 'CRITERIO', activa: true },
        ],
      });

      await service.setCriterios('m1', { criterios: [] });

      expect(prisma.moduloVersionPregunta.deleteMany).toHaveBeenCalledWith({
        where: {
          moduloVersionId: 'v-borrador',
          preguntaId: { in: ['p-criterio'] },
        },
      });
    });

    it('no duplica ni pisa el origen de una MANUAL que además matchea el criterio', async () => {
      enBorrador();
      conEstado({
        criterios: [{ id: 'c1', baseConocimientoId: BASE, nivelId: NIVEL }],
        pool: ['p-manual'],
        pivots: [{ preguntaId: 'p-manual', origen: 'MANUAL', activa: true }],
      });

      const res = await service.setCriterios('m1', {
        criterios: [{ baseConocimientoId: BASE, nivelId: NIVEL }],
      });

      expect(prisma.moduloVersionPregunta.createMany).not.toHaveBeenCalled();
      expect(prisma.moduloVersionPregunta.deleteMany).not.toHaveBeenCalled();
      expect(res.resolucion).toEqual(
        expect.objectContaining({ agregadas: 0, quitadas: 0 }),
      );
    });

    it('es idempotente: repetir el mismo set no agrega ni quita nada', async () => {
      enBorrador();
      conEstado({
        criterios: [{ id: 'c1', baseConocimientoId: BASE, nivelId: NIVEL }],
        pool: ['p1', 'p2'],
        pivots: [
          { preguntaId: 'p1', origen: 'CRITERIO', activa: true },
          { preguntaId: 'p2', origen: 'CRITERIO', activa: true },
        ],
      });

      const res = await service.setCriterios('m1', {
        criterios: [{ baseConocimientoId: BASE, nivelId: NIVEL }],
      });

      expect(prisma.moduloVersionPregunta.createMany).not.toHaveBeenCalled();
      expect(prisma.moduloVersionPregunta.deleteMany).not.toHaveBeenCalled();
      expect(res.resolucion).toEqual(
        expect.objectContaining({ agregadas: 0, quitadas: 0, conservadas: 2 }),
      );
    });

    it('un criterio sin nivel NO filtra por nivelId (es "cualquier nivel de la base")', async () => {
      enBorrador();
      conEstado({
        criterios: [{ id: 'c1', baseConocimientoId: BASE, nivelId: null }],
        pool: [],
        pivots: [],
      });

      await service.setCriterios('m1', {
        criterios: [{ baseConocimientoId: BASE }],
      });

      expect(prisma.pregunta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { activa: true, baseConocimientoId: BASE },
        }),
      );
      // Con `nivelId: null` en el where, matchearía sólo las preguntas SIN nivel.
      const where = prisma.pregunta.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('nivelId');
    });

    it('el pool ignora las preguntas en papelera global', async () => {
      enBorrador();
      conEstado({
        criterios: [{ id: 'c1', baseConocimientoId: BASE, nivelId: NIVEL }],
        pool: [],
        pivots: [],
      });

      await service.setCriterios('m1', {
        criterios: [{ baseConocimientoId: BASE, nivelId: NIVEL }],
      });

      expect(prisma.pregunta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activa: true }),
        }),
      );
    });

    it('reemplaza el set completo: borra los criterios previos antes de crear los nuevos', async () => {
      enBorrador();
      conEstado({ criterios: [], pool: [], pivots: [] });

      await service.setCriterios('m1', {
        criterios: [{ baseConocimientoId: BASE, nivelId: NIVEL }],
      });

      expect(prisma.moduloVersionCriterio.deleteMany).toHaveBeenCalledWith({
        where: { moduloVersionId: 'v-borrador' },
      });
      expect(prisma.moduloVersionCriterio.createMany).toHaveBeenCalledWith({
        data: [
          {
            moduloVersionId: 'v-borrador',
            baseConocimientoId: BASE,
            nivelId: NIVEL,
            createdBy: 'backoffice',
          },
        ],
      });
    });
  });

  it('cancelarBorrador elimina el módulo entero si el borrador era su única versión', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : null,
    );

    const resultado = await service.cancelarBorrador('m1');

    expect(prisma.moduloVersion.delete).toHaveBeenCalledWith({
      where: { id: 'v-borrador' },
    });
    expect(prisma.modulo.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(resultado).toEqual({ moduloEliminado: true });
  });

  describe('auditoría', () => {
    const actorIdentidad = {
      actorUsuarioId: 7,
      actorNombre: 'María',
      actorApellido: 'Gómez',
      actorRol: RolUsuario.ADMINISTRADOR,
    };

    // Lo que pidió verificar el usuario: un cambio de criterios que mueve
    // MUCHAS preguntas (acá 50) deja UNA sola fila de AuditLog en
    // ModuloVersion, no una por ModuloVersionPregunta tocada.
    it('setCriterios que agrega 50 preguntas genera UNA sola fila de auditoría', async () => {
      prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
        where.estado === 'BORRADOR'
          ? { id: 'v-borrador', estado: 'BORRADOR' }
          : null,
      );
      const pool = Array.from({ length: 50 }, (_, i) => `p${i}`);
      prisma.moduloVersionCriterio.findMany.mockResolvedValue([
        { id: 'c1', baseConocimientoId: 'base-1', nivelId: 'nivel-1' },
      ]);
      prisma.pregunta.findMany.mockResolvedValue(pool.map((id) => ({ id })));
      prisma.moduloVersionPregunta.findMany.mockResolvedValue([]);
      prisma.moduloVersionPregunta.aggregate.mockResolvedValue({
        _max: { orden: 0 },
      });

      await service.setCriterios(
        'm1',
        { criterios: [{ baseConocimientoId: 'base-1', nivelId: 'nivel-1' }] },
        actorIdentidad,
      );

      const llamadasModuloVersion = audit.registrar.mock.calls.filter(
        (c) => c[1].entidad === 'ModuloVersion',
      );
      expect(llamadasModuloVersion).toHaveLength(1);
      expect(llamadasModuloVersion[0][1]).toEqual({
        entidad: 'ModuloVersion',
        entidadId: 'v-borrador',
        accion: 'UPDATE',
        diff: {
          preguntas: { antes: null, despues: { agregadas: 50, quitadas: 0 } },
        },
        actor: 'backoffice',
        ...actorIdentidad,
      });
    });

    it('setCriterios idempotente (0 agregadas, 0 quitadas) no genera ninguna fila', async () => {
      prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
        where.estado === 'BORRADOR'
          ? { id: 'v-borrador', estado: 'BORRADOR' }
          : null,
      );
      prisma.moduloVersionCriterio.findMany.mockResolvedValue([
        { id: 'c1', baseConocimientoId: 'base-1', nivelId: 'nivel-1' },
      ]);
      prisma.pregunta.findMany.mockResolvedValue([{ id: 'p1' }]);
      prisma.moduloVersionPregunta.findMany.mockResolvedValue([
        { preguntaId: 'p1', origen: 'CRITERIO', activa: true },
      ]);

      await service.setCriterios('m1', {
        criterios: [{ baseConocimientoId: 'base-1', nivelId: 'nivel-1' }],
      });

      expect(audit.registrar).not.toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ entidad: 'ModuloVersion' }),
      );
    });

    it('asignarPreguntas de 3 preguntas genera UNA fila con las tres', async () => {
      prisma.moduloVersion.findFirst.mockResolvedValue({ id: 'v-borrador' });
      prisma.pregunta.count.mockResolvedValue(3);
      prisma.moduloVersionPregunta.createMany.mockResolvedValue({ count: 3 });
      prisma.moduloVersionPregunta.findMany.mockResolvedValue([]);

      await service.asignarPreguntas(
        'm1',
        [{ preguntaId: 'p1' }, { preguntaId: 'p2' }, { preguntaId: 'p3' }],
        actorIdentidad,
      );

      expect(audit.registrar).toHaveBeenCalledWith(prisma, {
        entidad: 'ModuloVersion',
        entidadId: 'v-borrador',
        accion: 'UPDATE',
        diff: {
          preguntas: { antes: null, despues: { agregadas: ['p1', 'p2', 'p3'] } },
        },
        actor: 'backoffice',
        ...actorIdentidad,
      });
    });

    it('setPreguntaActiva registra qué pregunta cambió y a qué valor', async () => {
      prisma.moduloVersion.findFirst.mockResolvedValue({ id: 'v-borrador' });
      prisma.moduloVersionPregunta.update.mockResolvedValue({
        preguntaId: 'p1',
        activa: false,
      });

      await service.setPreguntaActiva('m1', 'p1', false, actorIdentidad);

      expect(audit.registrar).toHaveBeenCalledWith(prisma, {
        entidad: 'ModuloVersion',
        entidadId: 'v-borrador',
        accion: 'UPDATE',
        diff: {
          pregunta: {
            antes: { id: 'p1', activa: true },
            despues: { id: 'p1', activa: false },
          },
        },
        actor: 'backoffice',
        ...actorIdentidad,
      });
    });

    it('unassignPregunta registra la pregunta quitada', async () => {
      prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
        where.estado === 'BORRADOR'
          ? { id: 'v-borrador', estado: 'BORRADOR' }
          : null,
      );

      await service.unassignPregunta('m1', 'p1', actorIdentidad);

      expect(audit.registrar).toHaveBeenCalledWith(prisma, {
        entidad: 'ModuloVersion',
        entidadId: 'v-borrador',
        accion: 'UPDATE',
        diff: { pregunta: { antes: { id: 'p1' }, despues: null } },
        actor: 'backoffice',
        ...actorIdentidad,
      });
    });

    it('create: un CREATE de Modulo y un CREATE de ModuloVersion (v1), dos filas distintas', async () => {
      prisma.modulo.create.mockResolvedValue({
        id: 'm1',
        nombre: 'SIMA Básico',
        activo: true,
        vigenciaMeses: null,
        demoPublico: false,
        versiones: [{ id: 'v1', numeroVersion: 1, estado: 'BORRADOR' }],
      });

      await service.create({ nombre: 'SIMA Básico' }, actorIdentidad);

      expect(audit.registrar).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ entidad: 'Modulo', entidadId: 'm1', accion: 'CREATE' }),
      );
      expect(audit.registrar).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entidad: 'ModuloVersion',
          entidadId: 'v1',
          accion: 'CREATE',
        }),
      );
    });

    it('update: diff sólo con lo que cambió', async () => {
      prisma.modulo.findUnique.mockResolvedValue({
        id: 'm1',
        nombre: 'Viejo',
        activo: true,
      });
      prisma.modulo.update.mockResolvedValue({
        id: 'm1',
        nombre: 'Nuevo',
        activo: true,
      });

      await service.update('m1', { nombre: 'Nuevo' }, actorIdentidad);

      expect(audit.registrar).toHaveBeenCalledWith(prisma, {
        entidad: 'Modulo',
        entidadId: 'm1',
        accion: 'UPDATE',
        diff: { nombre: { antes: 'Viejo', despues: 'Nuevo' } },
        actor: 'backoffice',
        ...actorIdentidad,
      });
    });

    it('activar con un ACTIVO previo: dos filas de ModuloVersion (la archivada y la publicada)', async () => {
      const activo = { id: 'v-activo', anio: 2026, mayor: 1, menor: 0 };
      prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
        where.estado === 'BORRADOR' ? { id: 'v-borrador' } : activo,
      );
      prisma.moduloVersion.update.mockImplementation(({ where, data }) => ({
        id: where.id,
        ...data,
      }));

      await service.activar('m1', false, actorIdentidad);

      const llamadasModuloVersion = audit.registrar.mock.calls.filter(
        (c) => c[1].entidad === 'ModuloVersion',
      );
      expect(llamadasModuloVersion).toHaveLength(2);
      expect(llamadasModuloVersion.map((c) => c[1].entidadId).sort()).toEqual(
        ['v-activo', 'v-borrador'].sort(),
      );
      const archivada = llamadasModuloVersion.find(
        (c) => c[1].entidadId === 'v-activo',
      )![1];
      expect(archivada.diff.estado).toEqual({
        antes: undefined,
        despues: 'ARCHIVADO',
      });
    });

    it('activar la primera publicación (sin ACTIVO previo): una sola fila de ModuloVersion', async () => {
      prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
        where.estado === 'BORRADOR' ? { id: 'v-borrador' } : null,
      );
      prisma.moduloVersion.aggregate.mockResolvedValue({ _max: { mayor: 0 } });
      prisma.moduloVersion.update.mockResolvedValue({
        id: 'v-borrador',
        estado: 'ACTIVO',
      });

      await service.activar('m1', undefined, actorIdentidad);

      const llamadasModuloVersion = audit.registrar.mock.calls.filter(
        (c) => c[1].entidad === 'ModuloVersion',
      );
      expect(llamadasModuloVersion).toHaveLength(1);
    });

    it('cancelarBorrador (con ACTIVO de respaldo): DELETE de ModuloVersion, sin tocar Modulo', async () => {
      prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
        where.estado === 'BORRADOR' ? { id: 'v-borrador' } : { id: 'v-activo' },
      );

      await service.cancelarBorrador('m1', actorIdentidad);

      expect(audit.registrar).toHaveBeenCalledWith(prisma, {
        entidad: 'ModuloVersion',
        entidadId: 'v-borrador',
        accion: 'DELETE',
        diff: { id: { antes: 'v-borrador', despues: null } },
        actor: 'backoffice',
        ...actorIdentidad,
      });
      expect(audit.registrar).not.toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ entidad: 'Modulo' }),
      );
    });

    it('cancelarBorrador (módulo nunca publicado): DELETE de ModuloVersion Y de Modulo', async () => {
      prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
        where.estado === 'BORRADOR' ? { id: 'v-borrador' } : null,
      );
      prisma.modulo.findUnique.mockResolvedValue({
        id: 'm1',
        nombre: 'Nunca publicado',
        activo: true,
      });

      await service.cancelarBorrador('m1', actorIdentidad);

      expect(audit.registrar).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entidad: 'ModuloVersion',
          entidadId: 'v-borrador',
          accion: 'DELETE',
        }),
      );
      expect(audit.registrar).toHaveBeenCalledWith(prisma, {
        entidad: 'Modulo',
        entidadId: 'm1',
        accion: 'DELETE',
        diff: {
          id: { antes: 'm1', despues: null },
          nombre: { antes: 'Nunca publicado', despues: null },
          activo: { antes: true, despues: null },
        },
        actor: 'backoffice',
        ...actorIdentidad,
      });
    });

    it('sin actorIdentidad, el log queda sin las 4 columnas de actor', async () => {
      prisma.modulo.create.mockResolvedValue({
        id: 'm1',
        nombre: 'SIMA Básico',
        versiones: [{ id: 'v1', numeroVersion: 1, estado: 'BORRADOR' }],
      });

      await service.create({ nombre: 'SIMA Básico' });

      const llamada = audit.registrar.mock.calls.find(
        (c) => c[1].entidad === 'Modulo',
      )![1];
      expect(llamada.actor).toBe('backoffice');
      expect(llamada.actorUsuarioId).toBeUndefined();
    });
  });
});
