import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService.registrar', () => {
  let service: AuditService;
  let prisma: { auditLog: { create: jest.Mock } };
  let tx: { auditLog: { create: jest.Mock } };

  beforeEach(async () => {
    // Dos clientes DISTINTOS a propósito: `prisma` es lo que se inyecta en el
    // service (this.prisma), `tx` es lo que se pasa como primer parámetro de
    // registrar(). Si el service escribiera por this.prisma en vez de por el
    // tx recibido, los tests de abajo lo detectarían.
    prisma = { auditLog: { create: jest.fn() } };
    tx = { auditLog: { create: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AuditService);
  });

  it('escribe el log cuando el diff tiene cambios', async () => {
    const diff = { nombre: { antes: 'Juan', despues: 'Ana' } };

    await service.registrar(tx as unknown as Prisma.TransactionClient, {
      entidad: 'Vinculacion',
      entidadId: '1',
      accion: 'UPDATE',
      diff,
      actor: 'backoffice',
    });

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        entidad: 'Vinculacion',
        entidadId: '1',
        accion: 'UPDATE',
        diff,
        actor: 'backoffice',
      },
    });
  });

  it('NO escribe nada cuando el diff está vacío', async () => {
    await service.registrar(tx as unknown as Prisma.TransactionClient, {
      entidad: 'Vinculacion',
      entidadId: '1',
      accion: 'UPDATE',
      diff: {},
      actor: 'backoffice',
    });

    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('escribe SIEMPRE por el tx recibido, nunca por this.prisma', async () => {
    const diff = { activo: { antes: true, despues: false } };

    await service.registrar(tx as unknown as Prisma.TransactionClient, {
      entidad: 'ReglaAsignacion',
      entidadId: 'r1',
      accion: 'UPDATE',
      diff,
      actor: 'backoffice',
    });

    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('con identidad real, las cuatro columnas de actor viajan al create', async () => {
    const diff = { nombre: { antes: 'Juan', despues: 'Ana' } };

    await service.registrar(tx as unknown as Prisma.TransactionClient, {
      entidad: 'Usuario',
      entidadId: '1',
      accion: 'UPDATE',
      diff,
      actor: 'backoffice',
      actorUsuarioId: 7,
      actorNombre: 'María',
      actorApellido: 'Gómez',
      actorRol: RolUsuario.ADMINISTRADOR,
    });

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        entidad: 'Usuario',
        entidadId: '1',
        accion: 'UPDATE',
        diff,
        actor: 'backoffice',
        actorUsuarioId: 7,
        actorNombre: 'María',
        actorApellido: 'Gómez',
        actorRol: 'ADMINISTRADOR',
      },
    });
  });

  it('sin identidad (import/seed), las cuatro columnas de actor quedan undefined — Prisma las graba NULL', async () => {
    const diff = { nombre: { antes: 'Juan', despues: 'Ana' } };

    await service.registrar(tx as unknown as Prisma.TransactionClient, {
      entidad: 'Usuario',
      entidadId: '1',
      accion: 'UPDATE',
      diff,
      actor: 'import',
    });

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        entidad: 'Usuario',
        entidadId: '1',
        accion: 'UPDATE',
        diff,
        actor: 'import',
        actorUsuarioId: undefined,
        actorNombre: undefined,
        actorApellido: undefined,
        actorRol: undefined,
      },
    });
  });
});

describe('AuditService.listarPorUsuario', () => {
  let service: AuditService;
  let prisma: {
    usuario: { findFirst: jest.Mock };
    vinculacion: { findUnique: jest.Mock };
    auditLog: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    // A propósito SIN `vinculacionPuestoCentro` en este mock: el método no
    // tiene que tocar esa tabla para nada (se borra físico al reemplazar el
    // set de pares, así que un par sacado no tiene fila). Si algún día el
    // código intentara leerla, estos tests fallarían solos con "Cannot read
    // properties of undefined" en vez de pasar en silencio.
    prisma = {
      usuario: { findFirst: jest.fn() },
      vinculacion: { findUnique: jest.fn() },
      auditLog: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AuditService);
  });

  it('404 si el usuario no existe', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);

    await expect(service.listarPorUsuario(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('no filtra por deletedAt al buscar el usuario ni la vinculación', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 1 });
    prisma.vinculacion.findUnique.mockResolvedValue({ id: 10 });
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.listarPorUsuario(1);

    expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true },
    });
    expect(prisma.vinculacion.findUnique).toHaveBeenCalledWith({
      where: { usuarioId: 1 },
      select: { id: true },
    });
  });

  it('un usuario dado de baja (deletedAt seteado) devuelve su log, no 404', async () => {
    // El mock no filtra de verdad (no es Postgres) — lo que prueba este test
    // es que el código, si la fila existiera con deletedAt seteado, la
    // seguiría encontrando: no hay ningún `deletedAt: null` en el where que
    // se manda arriba (ver el test anterior).
    prisma.usuario.findFirst.mockResolvedValue({ id: 1 });
    prisma.vinculacion.findUnique.mockResolvedValue({ id: 10 });
    const log = { id: 'l1', entidad: 'Vinculacion', entidadId: '10' };
    prisma.auditLog.findMany.mockResolvedValue([log]);

    const result = await service.listarPorUsuario(1);

    expect(result).toEqual([log]);
  });

  it('resuelve el where de auditLog con el entidadId exacto de la Vinculacion y el prefijo de sus pares', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 1 });
    prisma.vinculacion.findUnique.mockResolvedValue({ id: 10 });
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.listarPorUsuario(1);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { entidad: 'Vinculacion', entidadId: '10' },
          {
            entidad: 'VinculacionPuestoCentro',
            entidadId: { startsWith: '10:' },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('usuario sin vinculación: array vacío sin consultar AuditLog', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 1 });
    prisma.vinculacion.findUnique.mockResolvedValue(null);

    const result = await service.listarPorUsuario(1);

    expect(result).toEqual([]);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('usuario con vinculación pero sin logs: array vacío', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 1 });
    prisma.vinculacion.findUnique.mockResolvedValue({ id: 10 });
    prisma.auditLog.findMany.mockResolvedValue([]);

    const result = await service.listarPorUsuario(1);

    expect(result).toEqual([]);
  });

  it('un par agregado y después sacado aparece con su CREATE y su DELETE, aunque ya no exista ninguna fila en VinculacionPuestoCentro', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 1 });
    prisma.vinculacion.findUnique.mockResolvedValue({ id: 10 });
    const logDelete = {
      id: 'l2',
      entidad: 'VinculacionPuestoCentro',
      entidadId: '10:p-soldador:c-ypf',
      accion: 'DELETE',
    };
    const logCreate = {
      id: 'l1',
      entidad: 'VinculacionPuestoCentro',
      entidadId: '10:p-soldador:c-ypf',
      accion: 'CREATE',
    };
    // Más reciente primero, como devolvería la query real ordenada por
    // createdAt desc.
    prisma.auditLog.findMany.mockResolvedValue([logDelete, logCreate]);

    const result = await service.listarPorUsuario(1);

    expect(result).toEqual([logDelete, logCreate]);
  });
});

describe('AuditService.listarGlobal', () => {
  let service: AuditService;
  let prisma: {
    auditLog: { findMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      auditLog: { findMany: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AuditService);

    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);
  });

  it('sin filtros: where vacío, page/limit por default', async () => {
    await service.listarGlobal({});

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 50,
    });
  });

  it('combina entidad + actorRol + actorUsuarioId con AND', async () => {
    await service.listarGlobal({
      entidad: 'Modulo',
      actorRol: RolUsuario.ADMINISTRADOR,
      actorUsuarioId: 7,
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entidad: 'Modulo',
          actorRol: 'ADMINISTRADOR',
          actorUsuarioId: 7,
        },
      }),
    );
  });

  it('desde/hasta arman un rango sobre createdAt', async () => {
    const desde = new Date('2026-01-01T00:00:00.000Z');
    const hasta = new Date('2026-01-31T23:59:59.999Z');

    await service.listarGlobal({ desde, hasta });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: { gte: desde, lte: hasta } },
      }),
    );
  });

  it('pagina con skip/take derivados de page/limit', async () => {
    await service.listarGlobal({ page: 3, limit: 20 });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
  });

  it('devuelve data/total/page/limit', async () => {
    const log = { id: 'l1', entidad: 'Modulo' };
    prisma.auditLog.findMany.mockResolvedValue([log]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.listarGlobal({ page: 2, limit: 10 });

    expect(result).toEqual({ data: [log], total: 1, page: 2, limit: 10 });
  });
});
