import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let prisma: {
    usuario: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    organizacion: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      usuario: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      organizacion: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  it('crea un usuario con DNI libre', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({ id: 1 });
    await service.create({ nombre: 'Ana', apellido: 'Paz', dni: '30111222' });
    expect(prisma.usuario.create).toHaveBeenCalled();
  });

  it('rechaza alta con DNI duplicado (409)', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 9, dni: '30111222' });
    await expect(
      service.create({ nombre: 'Ana', apellido: 'Paz', dni: '30111222' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('findOne lanza NotFound si no existe o está dado de baja', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(service.findOne(7)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove hace soft-delete (setea deletedAt)', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 3 });
    prisma.usuario.update.mockResolvedValue({ id: 3, deletedAt: new Date() });
    await service.remove(3);
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3 },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });
});
