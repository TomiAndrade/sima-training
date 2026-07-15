import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ModulosService } from './modulos.service';

describe('ModulosService', () => {
  let service: ModulosService;
  let prisma: {
    modulo: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
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
      aggregate: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
      delete: jest.Mock;
    };
    pregunta: { count: jest.Mock; findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      modulo: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      moduloVersion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { numeroVersion: 0, mayor: 0 } }),
        delete: jest.fn(),
      },
      moduloVersionPregunta: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { orden: 0 } }),
        update: jest.fn(),
        deleteMany: jest.fn(),
        delete: jest.fn(),
      },
      pregunta: { count: jest.fn(), findUnique: jest.fn() },
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
          create: [{ preguntaId: 'p1', orden: 1, obligatoria: true, activa: true }],
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
    prisma.moduloVersion.update.mockResolvedValue({ id: 'v-borrador', estado: 'ACTIVO' });

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
    prisma.moduloVersion.update.mockResolvedValue({ id: 'v-borrador', estado: 'ACTIVO' });

    await service.activar('m1', false);

    expect(prisma.moduloVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-activo' },
      data: { estado: 'ARCHIVADO' },
    });
    expect(prisma.moduloVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-borrador' },
      data: expect.objectContaining({ esNuevaLinea: false, anio: 2026, mayor: 1, menor: 1 }),
    });
  });

  it('activar como versión nueva (mayor) sube el mayor y resetea el menor', async () => {
    const activo = { id: 'v-activo', anio: 2026, mayor: 1, menor: 3 };
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : activo,
    );
    prisma.moduloVersion.aggregate.mockResolvedValue({ _max: { mayor: 1 } });
    prisma.moduloVersion.update.mockResolvedValue({ id: 'v-borrador', estado: 'ACTIVO' });

    const anioActual = new Date().getFullYear();
    await service.activar('m1', true);

    expect(prisma.moduloVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-borrador' },
      data: expect.objectContaining({ esNuevaLinea: true, anio: anioActual, mayor: 2, menor: 0 }),
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

  it('findOne muestra el BORRADOR en curso, no el ACTIVO, cuando ambos coexisten', async () => {
    prisma.modulo.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : { id: 'v-activo' },
    );
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([{ preguntaId: 'p1' }]);

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
    prisma.moduloVersionPregunta.update.mockResolvedValue({ preguntaId: 'p1', activa: false });

    await service.setPreguntaActiva('m1', 'p1', false);

    expect(prisma.moduloVersionPregunta.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { moduloVersionId_preguntaId: { moduloVersionId: 'v-borrador', preguntaId: 'p1' } },
        data: { activa: false },
      }),
    );
  });

  it('setPreguntaActiva togglea sobre el ACTIVO cuando no hay borrador en curso', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? null : { id: 'v-activo' },
    );
    prisma.moduloVersionPregunta.update.mockResolvedValue({ preguntaId: 'p1', activa: false });

    await service.setPreguntaActiva('m1', 'p1', false);

    expect(prisma.moduloVersionPregunta.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { moduloVersionId_preguntaId: { moduloVersionId: 'v-activo', preguntaId: 'p1' } },
      }),
    );
  });

  it('setPreguntaActiva(true) rechaza si la pregunta está en la papelera global', async () => {
    prisma.moduloVersion.findFirst.mockResolvedValue({ id: 'v-borrador' });
    prisma.pregunta.findUnique.mockResolvedValue({ id: 'p1', activa: false });

    await expect(service.setPreguntaActiva('m1', 'p1', true)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.moduloVersionPregunta.update).not.toHaveBeenCalled();
  });

  it('setPreguntaActiva(true) reactiva el pivot cuando la pregunta no está en papelera', async () => {
    prisma.moduloVersion.findFirst.mockResolvedValue({ id: 'v-borrador' });
    prisma.pregunta.findUnique.mockResolvedValue({ id: 'p1', activa: true });
    prisma.moduloVersionPregunta.update.mockResolvedValue({ preguntaId: 'p1', activa: true });

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
      where.estado === 'BORRADOR' ? null : where.estado === 'ACTIVO' ? { id: 'v-activo', estado: 'ACTIVO' } : null,
    );
    await expect(service.unassignPregunta('m1', 'p1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.moduloVersionPregunta.delete).not.toHaveBeenCalled();
  });

  it('unassignPregunta borra el pivot cuando hay un borrador en curso', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador', estado: 'BORRADOR' } : null,
    );
    await service.unassignPregunta('m1', 'p1');
    expect(prisma.moduloVersionPregunta.delete).toHaveBeenCalledWith({
      where: { moduloVersionId_preguntaId: { moduloVersionId: 'v-borrador', preguntaId: 'p1' } },
    });
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
    expect(prisma.moduloVersion.delete).toHaveBeenCalledWith({ where: { id: 'v-borrador' } });
    expect(prisma.modulo.delete).not.toHaveBeenCalled();
    expect(resultado).toEqual({ moduloEliminado: false });
  });

  it('cancelarBorrador elimina el módulo entero si el borrador era su única versión', async () => {
    prisma.moduloVersion.findFirst.mockImplementation(({ where }) =>
      where.estado === 'BORRADOR' ? { id: 'v-borrador' } : null,
    );

    const resultado = await service.cancelarBorrador('m1');

    expect(prisma.moduloVersion.delete).toHaveBeenCalledWith({ where: { id: 'v-borrador' } });
    expect(prisma.modulo.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(resultado).toEqual({ moduloEliminado: true });
  });
});
