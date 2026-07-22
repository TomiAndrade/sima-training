import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolUsuario, TipoOrganizacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosService } from './usuarios.service';

// Usuario tal como lo devuelve Prisma con USUARIO_INCLUDE (lo que aRespuesta
// recibe): la vinculación anidada con su organización y sus pares.
const usuarioConVinculacion = (
  pares: { puesto: string; centro: string; principal: boolean }[] = [],
) => ({
  id: 1,
  nombre: 'Ana',
  apellido: 'Paz',
  dni: '30111222',
  vinculacion: {
    id: 10,
    usuarioId: 1,
    organizacionId: 1,
    rol: RolUsuario.ALUMNO,
    activa: true,
    organizacion: { id: 1, nombre: 'Ingeniería SIMA', tipo: 'INTERNA' },
    puestosCentros: pares.map((p) => ({
      puesto: { id: p.puesto, nombre: p.puesto },
      centroCosto: { id: p.centro, nombre: p.centro },
      principal: p.principal,
      activo: true,
    })),
  },
});

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
    puesto: { findMany: jest.Mock };
    centroCosto: { findMany: jest.Mock };
    vinculacionPuestoCentro: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const vinculacionSima = {
    organizacionId: 1,
    rol: RolUsuario.ALUMNO,
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
      puesto: { findMany: jest.fn() },
      centroCosto: { findMany: jest.fn() },
      vinculacionPuestoCentro: { deleteMany: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };

    // Por defecto: organización INTERNA (acepta cualquier rol) y DNI libre.
    prisma.organizacion.findUnique.mockResolvedValue({
      tipo: TipoOrganizacion.INTERNA,
    });
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue(usuarioConVinculacion());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  it('crea un usuario con DNI libre y su vinculación anidada', async () => {
    await service.create({
      nombre: 'Ana',
      apellido: 'Paz',
      dni: '30111222',
      vinculacion: vinculacionSima,
    });

    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dni: '30111222',
          vinculacion: {
            create: expect.objectContaining({
              organizacionId: 1,
              rol: RolUsuario.ALUMNO,
            }),
          },
        }),
      }),
    );
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
      service.create({
        nombre: 'Ana',
        apellido: 'Paz',
        dni: '30111222',
        vinculacion: vinculacionSima,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // --- Matriz tipo-de-organización ↔ rol ---

  it('rechaza un COORDINADOR en una organización CLIENTE (400)', async () => {
    prisma.organizacion.findUnique.mockResolvedValue({
      tipo: TipoOrganizacion.CLIENTE,
    });

    await expect(
      service.create({
        nombre: 'Ana',
        apellido: 'Paz',
        dni: '30111222',
        vinculacion: { organizacionId: 2, rol: RolUsuario.COORDINADOR },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it('acepta un AUDITOR en una organización CLIENTE', async () => {
    prisma.organizacion.findUnique.mockResolvedValue({
      tipo: TipoOrganizacion.CLIENTE,
    });

    await service.create({
      nombre: 'Ana',
      apellido: 'Paz',
      dni: '30111222',
      vinculacion: { organizacionId: 2, rol: RolUsuario.AUDITOR },
    });

    expect(prisma.usuario.create).toHaveBeenCalled();
  });

  it('rechaza un ADMINISTRADOR en una organización SUBCONTRATISTA (400)', async () => {
    prisma.organizacion.findUnique.mockResolvedValue({
      tipo: TipoOrganizacion.SUBCONTRATISTA,
    });

    await expect(
      service.create({
        nombre: 'Ana',
        apellido: 'Paz',
        dni: '30111222',
        vinculacion: { organizacionId: 3, rol: RolUsuario.ADMINISTRADOR },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('valida la matriz también al editar solo el rol', async () => {
    prisma.usuario.findFirst.mockResolvedValue({
      ...usuarioConVinculacion(),
      vinculacion: {
        ...usuarioConVinculacion().vinculacion,
        organizacionId: 2,
        rol: RolUsuario.AUDITOR,
      },
    });
    prisma.organizacion.findUnique.mockResolvedValue({
      tipo: TipoOrganizacion.CLIENTE,
    });

    await expect(
      service.update(1, { vinculacion: { rol: RolUsuario.COORDINADOR } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // --- Pares (puesto, centro de costo) ---

  it('crea la vinculación con varios pares, el primero como principal', async () => {
    prisma.puesto.findMany.mockResolvedValue([
      { id: 'p-soldador' },
      { id: 'p-amolador' },
    ]);
    prisma.centroCosto.findMany.mockResolvedValue([
      { id: 'c-ypf' },
      { id: 'c-pae' },
    ]);

    await service.create({
      nombre: 'Ana',
      apellido: 'Paz',
      dni: '30111222',
      vinculacion: {
        ...vinculacionSima,
        pares: [
          // El mismo puesto en dos centros son dos pares distintos.
          { puestoId: 'p-soldador', centroCostoId: 'c-ypf' },
          { puestoId: 'p-soldador', centroCostoId: 'c-pae' },
          { puestoId: 'p-amolador', centroCostoId: 'c-ypf' },
        ],
      },
    });

    const data = prisma.usuario.create.mock.calls[0][0].data;
    expect(data.vinculacion.create.puestosCentros.create).toEqual([
      expect.objectContaining({
        puestoId: 'p-soldador',
        centroCostoId: 'c-ypf',
        principal: true,
      }),
      expect.objectContaining({
        puestoId: 'p-soldador',
        centroCostoId: 'c-pae',
        principal: false,
      }),
      expect.objectContaining({
        puestoId: 'p-amolador',
        centroCostoId: 'c-ypf',
        principal: false,
      }),
    ]);
  });

  it('rechaza pares repetidos (violarían el PK compuesto)', async () => {
    await expect(
      service.create({
        nombre: 'Ana',
        apellido: 'Paz',
        dni: '30111222',
        vinculacion: {
          ...vinculacionSima,
          pares: [
            { puestoId: 'p-soldador', centroCostoId: 'c-ypf' },
            { puestoId: 'p-soldador', centroCostoId: 'c-ypf' },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un par con un puesto inexistente (400, no error de FK)', async () => {
    prisma.puesto.findMany.mockResolvedValue([]);
    prisma.centroCosto.findMany.mockResolvedValue([{ id: 'c-ypf' }]);

    await expect(
      service.create({
        nombre: 'Ana',
        apellido: 'Paz',
        dni: '30111222',
        vinculacion: {
          ...vinculacionSima,
          pares: [{ puestoId: 'p-fantasma', centroCostoId: 'c-ypf' }],
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // --- Listado ---

  it('findOne lanza NotFound si no existe o está dado de baja', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(service.findOne(7)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sin filtros, el listado NO oculta a las personas sin ningún par', async () => {
    prisma.usuario.findMany.mockResolvedValue([usuarioConVinculacion([])]);
    prisma.usuario.count.mockResolvedValue(1);

    const result = await service.findAll({ page: 1, limit: 50 });

    // Nada de `vinculacion` en el where: cero pares sigue siendo visible.
    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
    expect(result.total).toBe(1);
    expect(result.data[0].vinculacion?.parPrincipal).toBeNull();
    expect(result.data[0].vinculacion?.pares).toEqual([]);
  });

  it('expone el par principal y el rol anidado en la vinculación', async () => {
    prisma.usuario.findMany.mockResolvedValue([
      usuarioConVinculacion([
        { puesto: 'p-soldador', centro: 'c-ypf', principal: true },
        { puesto: 'p-amolador', centro: 'c-pae', principal: false },
      ]),
    ]);
    prisma.usuario.count.mockResolvedValue(1);

    const result = await service.findAll({});
    const usuario = result.data[0];

    expect(usuario).not.toHaveProperty('rol');
    expect(usuario.vinculacion?.rol).toBe(RolUsuario.ALUMNO);
    expect(usuario.vinculacion?.parPrincipal).toEqual(
      expect.objectContaining({
        puesto: { id: 'p-soldador', nombre: 'p-soldador' },
        centroCosto: { id: 'c-ypf', nombre: 'c-ypf' },
      }),
    );
    expect(usuario.vinculacion?.pares).toHaveLength(2);
  });

  it('filtra por rol y organización sobre la vinculación', async () => {
    prisma.usuario.findMany.mockResolvedValue([]);
    prisma.usuario.count.mockResolvedValue(0);

    await service.findAll({ rol: RolUsuario.AUDITOR, organizacionId: 2 });

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          vinculacion: { organizacionId: 2, rol: RolUsuario.AUDITOR },
        },
      }),
    );
  });

  it('filtra por par (puesto y centro) contra los pares activos', async () => {
    prisma.usuario.findMany.mockResolvedValue([]);
    prisma.usuario.count.mockResolvedValue(0);

    await service.findAll({ puestoId: 'p-soldador', centroCostoId: 'c-ypf' });

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          vinculacion: {
            puestosCentros: {
              some: {
                puestoId: 'p-soldador',
                centroCostoId: 'c-ypf',
                activo: true,
              },
            },
          },
        },
      }),
    );
  });

  it('pagina', async () => {
    prisma.usuario.findMany.mockResolvedValue([]);
    prisma.usuario.count.mockResolvedValue(0);

    const result = await service.findAll({ page: 2, limit: 10 });

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result).toEqual({ data: [], total: 0, page: 2, limit: 10 });
  });

  it('remove hace soft-delete (setea deletedAt)', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 3, vinculacion: null });
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
