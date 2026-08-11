import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
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
});
