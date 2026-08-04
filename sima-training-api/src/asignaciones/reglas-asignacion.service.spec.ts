import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AsignacionesService } from './asignaciones.service';
import { ReglasAsignacionService } from './reglas-asignacion.service';

// Regla por par exacto (puesto + centro).
const dto = {
  puestoId: 'p-soldador',
  centroCostoId: 'c-ypf',
  moduloId: 'm1',
};

// Regla de CENTRO: sin puesto, aplica a todos los puestos del centro.
const dtoCentro = {
  centroCostoId: 'c-taller',
  moduloId: 'm-basico',
};

// Fila existente sobre la que operan update/remove.
const reglaExistente = {
  id: 'r1',
  puestoId: 'p-soldador',
  centroCostoId: 'c-ypf',
  moduloId: 'm1',
  activo: true,
};

describe('ReglasAsignacionService', () => {
  let service: ReglasAsignacionService;
  let prisma: {
    $transaction: jest.Mock;
    reglaAsignacion: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    vinculacionPuestoCentro: { findMany: jest.Mock };
    puesto: { findUnique: jest.Mock };
    centroCosto: { findUnique: jest.Mock };
    modulo: { findUnique: jest.Mock };
  };
  let asignaciones: { recalcularEnTx: jest.Mock };

  beforeEach(async () => {
    prisma = {
      // El cliente transaccional es el mismo mock: los tests no distinguen
      // adentro/afuera de la transacción, solo qué queries se hicieron.
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
      reglaAsignacion: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      vinculacionPuestoCentro: { findMany: jest.fn() },
      puesto: { findUnique: jest.fn() },
      centroCosto: { findUnique: jest.fn() },
      modulo: { findUnique: jest.fn() },
    };
    // Por defecto las tres referencias existen.
    prisma.puesto.findUnique.mockResolvedValue({ id: dto.puestoId });
    prisma.centroCosto.findUnique.mockResolvedValue({ id: dto.centroCostoId });
    prisma.modulo.findUnique.mockResolvedValue({ id: dto.moduloId });
    // Por defecto nadie trabaja en el centro → el recálculo no hace nada.
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([]);
    // La fila que devuelve cualquier update, salvo que el test pida otra cosa
    // (el service la usa para saber sobre qué centro recalcular).
    prisma.reglaAsignacion.update.mockResolvedValue(reglaExistente);

    asignaciones = {
      recalcularEnTx: jest.fn().mockResolvedValue({ creadas: 0, revocadas: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReglasAsignacionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AsignacionesService, useValue: asignaciones },
      ],
    }).compile();

    service = module.get(ReglasAsignacionService);
  });

  it('crea la regla cuando el triple no existe todavía', async () => {
    prisma.reglaAsignacion.findFirst.mockResolvedValue(null);
    prisma.reglaAsignacion.create.mockResolvedValue({ id: 'r1', ...dto });

    await service.create(dto);

    expect(prisma.reglaAsignacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ...dto, createdBy: 'backoffice' }),
    });
  });

  it('reactiva la regla existente en vez de duplicar el triple', async () => {
    prisma.reglaAsignacion.findFirst.mockResolvedValue({
      id: 'r1',
      activo: false,
    });
    prisma.reglaAsignacion.update.mockResolvedValue({ id: 'r1', activo: true });

    await service.create(dto);

    expect(prisma.reglaAsignacion.create).not.toHaveBeenCalled();
    expect(prisma.reglaAsignacion.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ activo: true }),
    });
  });

  it('rechaza el alta si el módulo no existe (400, no error de FK)', async () => {
    prisma.modulo.findUnique.mockResolvedValue(null);
    await expect(service.create(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.reglaAsignacion.create).not.toHaveBeenCalled();
  });

  it('filtra el listado solo por lo que viene', async () => {
    prisma.reglaAsignacion.findMany.mockResolvedValue([]);

    await service.findAll({ puestoId: 'p-soldador', activo: true });

    expect(prisma.reglaAsignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // deletedAt: null siempre — las eliminadas no se listan nunca.
        where: { deletedAt: null, puestoId: 'p-soldador', activo: true },
      }),
    );
  });

  // --- Reglas a NIVEL CENTRO DE COSTO (sin puesto) ------------------------

  it('crea una regla de centro con puestoId null y sin validar puesto', async () => {
    prisma.reglaAsignacion.findFirst.mockResolvedValue(null);
    prisma.reglaAsignacion.create.mockResolvedValue({ id: 'r2', ...dtoCentro });

    await service.create(dtoCentro);

    // No hay puesto que validar: ni se consulta el catálogo.
    expect(prisma.puesto.findUnique).not.toHaveBeenCalled();
    expect(prisma.reglaAsignacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ...dtoCentro, puestoId: null }),
    });
  });

  it('busca la regla de centro por puestoId null, no por undefined', async () => {
    // Es lo que evita que reactive una regla de PAR cualquiera del mismo
    // centro+módulo: con undefined Prisma omitiría la condición.
    prisma.reglaAsignacion.findFirst.mockResolvedValue(null);
    prisma.reglaAsignacion.create.mockResolvedValue({ id: 'r2' });

    await service.create(dtoCentro);

    expect(prisma.reglaAsignacion.findFirst).toHaveBeenCalledWith({
      where: { puestoId: null, ...dtoCentro, deletedAt: null },
    });
  });

  it('reactiva una regla de centro dada de baja en vez de duplicarla', async () => {
    prisma.reglaAsignacion.findFirst.mockResolvedValue({
      id: 'r2',
      activo: false,
    });
    prisma.reglaAsignacion.update.mockResolvedValue({ id: 'r2', activo: true });

    await service.create(dtoCentro);

    expect(prisma.reglaAsignacion.create).not.toHaveBeenCalled();
    expect(prisma.reglaAsignacion.update).toHaveBeenCalledWith({
      where: { id: 'r2' },
      data: expect.objectContaining({ activo: true }),
    });
  });

  it('?alcance=CENTRO trae solo las reglas sin puesto', async () => {
    prisma.reglaAsignacion.findMany.mockResolvedValue([]);

    await service.findAll({ alcance: 'CENTRO' });

    expect(prisma.reglaAsignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, AND: { puestoId: null } },
      }),
    );
  });

  it('?alcance=PUESTO trae solo las reglas por par exacto', async () => {
    prisma.reglaAsignacion.findMany.mockResolvedValue([]);

    await service.findAll({ alcance: 'PUESTO' });

    expect(prisma.reglaAsignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, AND: { puestoId: { not: null } } },
      }),
    );
  });

  it('?puestoId= y ?alcance=CENTRO no se pisan: quedan como condiciones contradictorias', async () => {
    // El alcance va en un AND, así que NO sobreescribe el filtro de puesto.
    prisma.reglaAsignacion.findMany.mockResolvedValue([]);

    await service.findAll({ puestoId: 'p-soldador', alcance: 'CENTRO' });

    expect(prisma.reglaAsignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          puestoId: 'p-soldador',
          AND: { puestoId: null },
        },
      }),
    );
  });

  // --- Edición del módulo -------------------------------------------------

  it('cambia el módulo de la regla y recalcula a la gente del centro', async () => {
    prisma.reglaAsignacion.findUnique.mockResolvedValue(reglaExistente);
    prisma.reglaAsignacion.findFirst.mockResolvedValue(null); // destino libre
    prisma.reglaAsignacion.update.mockResolvedValue({
      ...reglaExistente,
      moduloId: 'm2',
    });
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      { vinculacion: { usuarioId: 7 } },
      { vinculacion: { usuarioId: 9 } },
      // Dos pares de la misma persona en el centro → un solo recálculo.
      { vinculacion: { usuarioId: 7 } },
    ]);
    asignaciones.recalcularEnTx.mockResolvedValue({ creadas: 1, revocadas: 1 });

    const res = await service.update('r1', { moduloId: 'm2' });

    expect(prisma.reglaAsignacion.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ moduloId: 'm2' }),
    });
    expect(asignaciones.recalcularEnTx).toHaveBeenCalledTimes(2);
    expect(res.recalculo).toEqual({ usuarios: 2, creadas: 2, revocadas: 2 });
  });

  it('rechaza la edición si el módulo nuevo no existe (400)', async () => {
    prisma.modulo.findUnique.mockResolvedValue(null);

    await expect(
      service.update('r1', { moduloId: 'm-fantasma' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.reglaAsignacion.update).not.toHaveBeenCalled();
  });

  it('rechaza la edición si ya hay otra regla con ese módulo y alcance (409)', async () => {
    prisma.reglaAsignacion.findUnique.mockResolvedValue(reglaExistente);
    prisma.reglaAsignacion.findFirst.mockResolvedValue({
      id: 'r-otra',
      activo: false,
    });

    await expect(
      service.update('r1', { moduloId: 'm2' }),
    ).rejects.toBeInstanceOf(ConflictException);
    // El destino se busca por el MISMO alcance de la regla, excluyéndola a ella
    // y sin contar las eliminadas (el índice tampoco las considera).
    expect(prisma.reglaAsignacion.findFirst).toHaveBeenCalledWith({
      where: {
        puestoId: 'p-soldador',
        centroCostoId: 'c-ypf',
        moduloId: 'm2',
        id: { not: 'r1' },
        deletedAt: null,
      },
    });
    expect(prisma.reglaAsignacion.update).not.toHaveBeenCalled();
  });

  it('rechaza un PATCH vacío (400) en vez de escribir solo updatedBy', async () => {
    await expect(service.update('r1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('setActivo togglea la baja lógica y dispara el recálculo', async () => {
    prisma.reglaAsignacion.findUnique.mockResolvedValue(reglaExistente);
    prisma.reglaAsignacion.update.mockResolvedValue({
      ...reglaExistente,
      activo: false,
    });
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      { vinculacion: { usuarioId: 7 } },
    ]);

    await service.setActivo('r1', false);

    expect(prisma.reglaAsignacion.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ activo: false }),
    });
    // Sin módulo nuevo no hay colisión que chequear.
    expect(prisma.reglaAsignacion.findFirst).not.toHaveBeenCalled();
    expect(asignaciones.recalcularEnTx).toHaveBeenCalledWith(
      prisma,
      7,
      'backoffice',
    );
  });

  it('el alta también recalcula a la gente del centro', async () => {
    prisma.reglaAsignacion.findFirst.mockResolvedValue(null);
    prisma.reglaAsignacion.create.mockResolvedValue({ id: 'r1', ...dto });
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      { vinculacion: { usuarioId: 7 } },
    ]);

    await service.create(dto);

    expect(prisma.vinculacionPuestoCentro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activo: true,
          centroCostoId: 'c-ypf',
        }),
      }),
    );
    expect(asignaciones.recalcularEnTx).toHaveBeenCalledTimes(1);
  });

  // --- Eliminar = baja lógica ---------------------------------------------

  it('eliminar es baja lógica: nunca borra la fila', async () => {
    prisma.reglaAsignacion.findUnique.mockResolvedValue(reglaExistente);
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      { vinculacion: { usuarioId: 7 } },
    ]);
    asignaciones.recalcularEnTx.mockResolvedValue({ creadas: 0, revocadas: 1 });

    const res = await service.remove('r1');

    // La fila es la única evidencia de por qué alguien tuvo que rendir: se marca,
    // no se borra. `activo` no se toca: es el otro eje.
    expect(prisma.reglaAsignacion.delete).not.toHaveBeenCalled();
    expect(prisma.reglaAsignacion.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { deletedAt: expect.any(Date), updatedBy: 'backoffice' },
    });
    // El orden importa: el motor tiene que leer la base SIN la regla.
    expect(
      prisma.reglaAsignacion.update.mock.invocationCallOrder[0],
    ).toBeLessThan(asignaciones.recalcularEnTx.mock.invocationCallOrder[0]);
    expect(res.recalculo).toEqual({ usuarios: 1, creadas: 0, revocadas: 1 });
  });

  it('eliminar una regla inexistente da 404, no 400', async () => {
    prisma.reglaAsignacion.findUnique.mockResolvedValue(null);

    await expect(service.remove('r-fantasma')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.reglaAsignacion.update).not.toHaveBeenCalled();
  });

  it('eliminar una regla YA eliminada da 404: no existe a ningún efecto', async () => {
    prisma.reglaAsignacion.findUnique.mockResolvedValue({
      ...reglaExistente,
      deletedAt: new Date(),
    });

    await expect(service.remove('r1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.reglaAsignacion.update).not.toHaveBeenCalled();
  });

  it('editar una regla eliminada da 404', async () => {
    prisma.reglaAsignacion.findUnique.mockResolvedValue({
      ...reglaExistente,
      deletedAt: new Date(),
    });

    await expect(service.update('r1', { activo: true })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.reglaAsignacion.update).not.toHaveBeenCalled();
  });

  it('revive la regla eliminada en vez de crear otra (y limpia deletedAt)', async () => {
    // 1ª búsqueda (la viva) no encuentra nada; la 2ª sí, eliminada.
    prisma.reglaAsignacion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...reglaExistente,
        activo: false,
        deletedAt: new Date(),
      });

    await service.create(dto);

    expect(prisma.reglaAsignacion.create).not.toHaveBeenCalled();
    expect(prisma.reglaAsignacion.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { activo: true, deletedAt: null, updatedBy: 'backoffice' },
    });
  });

  it('si hay una viva y una eliminada del mismo triple, gana la viva', async () => {
    // Coexisten porque el índice parcial sólo prohíbe DOS VIVAS: se llega ahí
    // moviendo una regla viva al módulo de una eliminada. Si el alta agarrara la
    // eliminada y la reviviera, chocaría contra la viva con un P2002.
    prisma.reglaAsignacion.findFirst.mockResolvedValueOnce({
      ...reglaExistente,
      id: 'r-viva',
    });

    await service.create(dto);

    // Una sola búsqueda: encontrada la viva, la eliminada ni se consulta.
    expect(prisma.reglaAsignacion.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.reglaAsignacion.update).toHaveBeenCalledWith({
      where: { id: 'r-viva' },
      data: expect.objectContaining({ activo: true }),
    });
  });

  it('mover una regla al módulo de una ELIMINADA no es colisión', async () => {
    prisma.reglaAsignacion.findUnique.mockResolvedValue(reglaExistente);
    // La eliminada no entra en el where de la colisión, así que no aparece.
    prisma.reglaAsignacion.findFirst.mockResolvedValue(null);
    prisma.reglaAsignacion.update.mockResolvedValue({
      ...reglaExistente,
      moduloId: 'm2',
    });

    await expect(service.update('r1', { moduloId: 'm2' })).resolves.toEqual(
      expect.objectContaining({
        regla: expect.objectContaining({ moduloId: 'm2' }),
      }),
    );
  });

  it('no recalcula a usuarios dados de baja (abortarían la transacción con un 404)', async () => {
    prisma.reglaAsignacion.findUnique.mockResolvedValue(reglaExistente);

    await service.remove('r1');

    expect(prisma.vinculacionPuestoCentro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vinculacion: { deletedAt: null, usuario: { deletedAt: null } },
        }),
      }),
    );
  });
});
