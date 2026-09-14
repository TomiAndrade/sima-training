import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolUsuario } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizacionesService } from './organizaciones.service';

describe('OrganizacionesService', () => {
  let service: OrganizacionesService;
  let prisma: {
    organizacion: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let audit: { registrar: jest.Mock };

  const actorIdentidad = {
    actorUsuarioId: 7,
    actorNombre: 'María',
    actorApellido: 'Gómez',
    actorRol: RolUsuario.ADMINISTRADOR,
  };

  beforeEach(async () => {
    prisma = {
      organizacion: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      // Mismo patrón que usuarios.service.spec.ts: el mock de $transaction
      // corre el callback pasándole el mismo `prisma` como `tx`, así los
      // mocks de arriba sirven para las dos cosas.
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizacionesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(OrganizacionesService);
  });

  it('crea un cliente sin padre', async () => {
    prisma.organizacion.create.mockResolvedValue({ id: 1 });
    await service.create({ nombre: 'YPF' });
    expect(prisma.organizacion.create).toHaveBeenCalled();
  });

  it('rechaza crear con padre inexistente', async () => {
    prisma.organizacion.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ nombre: 'Sub', organizacionPadreId: 999 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findOne lanza NotFound si no existe', async () => {
    prisma.organizacion.findUnique.mockResolvedValue(null);
    await expect(service.findOne(42)).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('auditoría', () => {
    it('create setea createdBy y genera un CREATE con los campos reales (sin ruido de trazabilidad)', async () => {
      prisma.organizacion.create.mockResolvedValue({
        id: 1,
        nombre: 'YPF',
        tipo: 'CLIENTE',
        organizacionPadreId: null,
        activa: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'backoffice',
        updatedBy: null,
      });

      await service.create({ nombre: 'YPF' }, actorIdentidad);

      expect(prisma.organizacion.create).toHaveBeenCalledWith({
        data: { nombre: 'YPF', createdBy: 'backoffice' },
      });
      expect(audit.registrar).toHaveBeenCalledWith(prisma, {
        entidad: 'Organizacion',
        entidadId: '1',
        accion: 'CREATE',
        diff: {
          id: { antes: null, despues: 1 },
          nombre: { antes: null, despues: 'YPF' },
          tipo: { antes: null, despues: 'CLIENTE' },
          activa: { antes: null, despues: true },
        },
        actor: 'backoffice',
        ...actorIdentidad,
      });
    });

    it('update lee el "antes" de la transacción y audita sólo lo que cambió', async () => {
      const antes = {
        id: 1,
        nombre: 'YPF',
        tipo: 'CLIENTE',
        organizacionPadreId: null,
        activa: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'backoffice',
        updatedBy: null,
      };
      prisma.organizacion.findUnique.mockResolvedValue(antes);
      prisma.organizacion.update.mockResolvedValue({
        ...antes,
        activa: false,
        updatedBy: 'backoffice',
      });

      await service.update(1, { activa: false }, actorIdentidad);

      expect(prisma.organizacion.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { activa: false, updatedBy: 'backoffice' },
      });
      expect(audit.registrar).toHaveBeenCalledWith(prisma, {
        entidad: 'Organizacion',
        entidadId: '1',
        accion: 'UPDATE',
        diff: { activa: { antes: true, despues: false } },
        actor: 'backoffice',
        ...actorIdentidad,
      });
    });

    it('update sobre una organización inexistente es 404 y no audita nada', async () => {
      prisma.organizacion.findUnique.mockResolvedValue(null);

      await expect(
        service.update(99, { activa: false }, actorIdentidad),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it('update sin cambios reales no genera ningún log', async () => {
      const antes = {
        id: 1,
        nombre: 'YPF',
        tipo: 'CLIENTE',
        organizacionPadreId: null,
        activa: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'backoffice',
        updatedBy: null,
      };
      prisma.organizacion.findUnique.mockResolvedValue(antes);
      prisma.organizacion.update.mockResolvedValue({
        ...antes,
        updatedBy: 'backoffice',
      });

      await service.update(1, { nombre: 'YPF' }, actorIdentidad);

      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it('sin actorIdentidad (caller sin identidad resuelta), el log queda sin las 4 columnas de actor', async () => {
      prisma.organizacion.create.mockResolvedValue({
        id: 1,
        nombre: 'YPF',
        tipo: 'CLIENTE',
        organizacionPadreId: null,
        activa: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'backoffice',
        updatedBy: null,
      });

      await service.create({ nombre: 'YPF' });

      expect(audit.registrar).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ actor: 'backoffice' }),
      );
      const llamada = audit.registrar.mock.calls[0][1];
      expect(llamada.actorUsuarioId).toBeUndefined();
    });
  });
});
