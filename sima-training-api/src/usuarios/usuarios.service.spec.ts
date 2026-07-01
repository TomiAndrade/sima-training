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
      count: jest.Mock;
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
        count: jest.fn(),
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
    // findFirst se llama dos veces en create(): primero para revivir un
    // usuario dado de baja (deletedAt: not null), luego para chequear DNI
    // disponible entre los activos (deletedAt: null). Acá no hay ninguno
    // dado de baja, pero sí uno activo con el mismo DNI.
    prisma.usuario.findFirst.mockImplementation(({ where }) =>
      where.deletedAt === null
        ? Promise.resolve({ id: 9, dni: '30111222' })
        : Promise.resolve(null),
    );
    await expect(
      service.create({ nombre: 'Ana', apellido: 'Paz', dni: '30111222' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('findOne lanza NotFound si no existe o está dado de baja', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(service.findOne(7)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll filtra por clasificacion y pagina', async () => {
    prisma.usuario.findMany.mockResolvedValue([
      { id: 1, clasificacion: 'SIMA' },
    ]);
    prisma.usuario.count.mockResolvedValue(1);

    const result = await service.findAll({
      clasificacion: 'SIMA' as any,
      page: 2,
      limit: 10,
    });

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, clasificacion: 'SIMA' },
        skip: 10,
        take: 10,
      }),
    );
    expect(result).toEqual({
      data: [{ id: 1, clasificacion: 'SIMA' }],
      total: 1,
      page: 2,
      limit: 10,
    });
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
