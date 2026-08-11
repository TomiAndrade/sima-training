import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolUsuario, TipoOrganizacion } from '@prisma/client';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SesionesService } from '../sesiones/sesiones.service';
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
    vinculacion: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let asignaciones: { recalcularEnTx: jest.Mock };
  let audit: { registrar: jest.Mock };

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
      vinculacion: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    asignaciones = { recalcularEnTx: jest.fn().mockResolvedValue(undefined) };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };

    // Por defecto: organización INTERNA (acepta cualquier rol) y DNI libre.
    prisma.organizacion.findUnique.mockResolvedValue({
      tipo: TipoOrganizacion.INTERNA,
    });
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue(usuarioConVinculacion());
    // Default inocuo: "no había vinculación antes" — a los tests que no les
    // importa la auditoría (la mayoría, preexistentes a Story 9) les alcanza
    // con que esta lectura nueva no reviente; los tests de auditoría lo
    // pisan con un estado previo real.
    prisma.vinculacion.findUnique.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AsignacionesService, useValue: asignaciones },
        { provide: AuditService, useValue: audit },
        // Story 10: sólo lo pide el constructor — este archivo no ejercita
        // informe(), eso vive en usuarios.service.informe.spec.ts.
        { provide: SesionesService, useValue: {} },
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

  // --- Recálculo automático de asignaciones al cambiar los pares ---

  it('alta sin pares no recalcula (camino del import)', async () => {
    // Desde Story 9 esta rama SÍ abre una transacción chica (create + audit
    // log — AuditService.registrar() exige un cliente transaccional), así
    // que ya no vale la afirmación "no abre transacción" que tenía este test
    // antes de la auditoría. Lo que sigue siendo cierto, y es lo que importa
    // acá, es que sin pares no hay nada que recalcular.
    await service.create({
      nombre: 'Ana',
      apellido: 'Paz',
      dni: '30111222',
      vinculacion: vinculacionSima,
    });

    expect(asignaciones.recalcularEnTx).not.toHaveBeenCalled();
  });

  it('alta con pares recalcula en la misma transacción', async () => {
    prisma.puesto.findMany.mockResolvedValue([{ id: 'p-soldador' }]);
    prisma.centroCosto.findMany.mockResolvedValue([{ id: 'c-ypf' }]);

    await service.create({
      nombre: 'Ana',
      apellido: 'Paz',
      dni: '30111222',
      vinculacion: {
        ...vinculacionSima,
        pares: [{ puestoId: 'p-soldador', centroCostoId: 'c-ypf' }],
      },
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    // El id sale del usuario recién creado (mock → id 1), y corre sobre el mismo
    // cliente transaccional (el mock de $transaction pasa `prisma` como tx).
    expect(asignaciones.recalcularEnTx).toHaveBeenCalledWith(
      prisma,
      1,
      'backoffice',
    );
  });

  it('revivir un usuario dado de baja recalcula SIEMPRE, aunque no traiga pares', async () => {
    // El chequeo "dado de baja" (deletedAt: { not: null }) encuentra id 5.
    prisma.usuario.findFirst.mockImplementation(({ where }) =>
      where.deletedAt && typeof where.deletedAt === 'object'
        ? Promise.resolve({ id: 5 })
        : Promise.resolve(null),
    );
    prisma.usuario.update.mockResolvedValue(usuarioConVinculacion());

    await service.create({
      nombre: 'Ana',
      apellido: 'Paz',
      dni: '30111222',
      vinculacion: vinculacionSima, // sin pares
    });

    // Un revivido puede arrastrar AUTOMATICA de antes de la baja: recalcular
    // igual, para revocar las que ya no correspondan.
    expect(asignaciones.recalcularEnTx).toHaveBeenCalledWith(
      prisma,
      5,
      'backoffice',
    );
  });

  it('update con pares dispara el recálculo', async () => {
    prisma.usuario.findFirst.mockResolvedValue(usuarioConVinculacion());
    prisma.usuario.update.mockResolvedValue(usuarioConVinculacion());
    prisma.puesto.findMany.mockResolvedValue([{ id: 'p-soldador' }]);
    prisma.centroCosto.findMany.mockResolvedValue([{ id: 'c-ypf' }]);

    await service.update(1, {
      vinculacion: {
        pares: [{ puestoId: 'p-soldador', centroCostoId: 'c-ypf' }],
      },
    });

    expect(asignaciones.recalcularEnTx).toHaveBeenCalledWith(
      prisma,
      1,
      'backoffice',
    );
  });

  it('update de solo el nombre NO recalcula', async () => {
    prisma.usuario.findFirst.mockResolvedValue(usuarioConVinculacion());
    prisma.usuario.update.mockResolvedValue(usuarioConVinculacion());

    await service.update(1, { nombre: 'Ana María' });

    expect(asignaciones.recalcularEnTx).not.toHaveBeenCalled();
  });

  it('update de solo el rol NO recalcula (el rol no es input del recálculo)', async () => {
    prisma.usuario.findFirst.mockResolvedValue(usuarioConVinculacion());
    prisma.usuario.update.mockResolvedValue(usuarioConVinculacion());

    await service.update(1, { vinculacion: { rol: RolUsuario.COORDINADOR } });

    expect(asignaciones.recalcularEnTx).not.toHaveBeenCalled();
  });

  it('update con `pares: []` (vaciar) recalcula, para revocar las que sobran', async () => {
    prisma.usuario.findFirst.mockResolvedValue(usuarioConVinculacion());
    prisma.usuario.update.mockResolvedValue(usuarioConVinculacion());

    await service.update(1, { vinculacion: { pares: [] } });

    expect(asignaciones.recalcularEnTx).toHaveBeenCalledWith(
      prisma,
      1,
      'backoffice',
    );
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

  // --- Auditoría de Vinculacion y sus pares (Story 9, paso 3) -------------
  // `prisma.vinculacion.findUnique` se llama DOS veces dentro de update()
  // (antes de escribir y después, ver el service): mockResolvedValueOnce
  // encadenado dos veces simula el "antes" y el "después" por separado. En
  // remove() se llama una sola vez.

  describe('auditoría', () => {
    it('el alta con pares genera un CREATE de Vinculacion y un CREATE por cada par', async () => {
      prisma.puesto.findMany.mockResolvedValue([{ id: 'p-soldador' }]);
      prisma.centroCosto.findMany.mockResolvedValue([{ id: 'c-ypf' }]);
      prisma.usuario.create.mockResolvedValue({
        id: 1,
        vinculacion: {
          id: 10,
          usuarioId: 1,
          organizacionId: 1,
          rol: RolUsuario.ALUMNO,
          activa: true,
          puestosCentros: [
            {
              puestoId: 'p-soldador',
              centroCostoId: 'c-ypf',
              principal: true,
              activo: true,
            },
          ],
        },
      });

      await service.create({
        nombre: 'Ana',
        apellido: 'Paz',
        dni: '30111222',
        vinculacion: {
          ...vinculacionSima,
          pares: [{ puestoId: 'p-soldador', centroCostoId: 'c-ypf' }],
        },
      });

      expect(audit.registrar).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entidad: 'Vinculacion',
          accion: 'CREATE',
          actor: 'backoffice',
        }),
      );
      expect(audit.registrar).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entidad: 'VinculacionPuestoCentro',
          accion: 'CREATE',
          entidadId: '10:p-soldador:c-ypf',
          actor: 'backoffice',
        }),
      );
    });

    it('el actor pasado a create() es el que queda en el log', async () => {
      prisma.usuario.create.mockResolvedValue({
        id: 1,
        vinculacion: {
          id: 10,
          usuarioId: 1,
          organizacionId: 1,
          rol: RolUsuario.ALUMNO,
          activa: true,
          puestosCentros: [],
        },
      });

      await service.create(
        {
          nombre: 'Ana',
          apellido: 'Paz',
          dni: '30111222',
          vinculacion: vinculacionSima,
        },
        'import',
      );

      expect(audit.registrar).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ entidad: 'Vinculacion', actor: 'import' }),
      );
    });

    it('cambiar sólo el rol genera un UPDATE de Vinculacion con sólo ese campo en el diff', async () => {
      prisma.usuario.findFirst.mockResolvedValue(usuarioConVinculacion());
      prisma.usuario.update.mockResolvedValue(usuarioConVinculacion());
      prisma.vinculacion.findUnique
        .mockResolvedValueOnce({
          id: 10,
          usuarioId: 1,
          organizacionId: 1,
          rol: RolUsuario.ALUMNO,
          activa: true,
          puestosCentros: [],
        })
        .mockResolvedValueOnce({
          id: 10,
          usuarioId: 1,
          organizacionId: 1,
          rol: RolUsuario.COORDINADOR,
          activa: true,
          puestosCentros: [],
        });

      await service.update(1, { vinculacion: { rol: RolUsuario.COORDINADOR } });

      expect(audit.registrar).toHaveBeenCalledWith(prisma, {
        entidad: 'Vinculacion',
        entidadId: '10',
        accion: 'UPDATE',
        diff: {
          rol: { antes: RolUsuario.ALUMNO, despues: RolUsuario.COORDINADOR },
        },
        actor: 'backoffice',
      });
    });

    it('agregar un par nuevo genera un CREATE sólo de ese par', async () => {
      prisma.usuario.findFirst.mockResolvedValue(usuarioConVinculacion());
      prisma.usuario.update.mockResolvedValue(usuarioConVinculacion());
      prisma.puesto.findMany.mockResolvedValue([
        { id: 'p-soldador' },
        { id: 'p-amolador' },
      ]);
      prisma.centroCosto.findMany.mockResolvedValue([{ id: 'c-ypf' }]);
      const parViejo = {
        puestoId: 'p-soldador',
        centroCostoId: 'c-ypf',
        principal: true,
        activo: true,
      };
      const parNuevo = {
        puestoId: 'p-amolador',
        centroCostoId: 'c-ypf',
        principal: false,
        activo: true,
      };
      prisma.vinculacion.findUnique
        .mockResolvedValueOnce({
          id: 10,
          usuarioId: 1,
          organizacionId: 1,
          rol: RolUsuario.ALUMNO,
          activa: true,
          puestosCentros: [parViejo],
        })
        .mockResolvedValueOnce({
          id: 10,
          usuarioId: 1,
          organizacionId: 1,
          rol: RolUsuario.ALUMNO,
          activa: true,
          puestosCentros: [parViejo, parNuevo],
        });

      await service.update(1, {
        vinculacion: {
          pares: [
            { puestoId: 'p-soldador', centroCostoId: 'c-ypf' },
            { puestoId: 'p-amolador', centroCostoId: 'c-ypf' },
          ],
        },
      });

      expect(audit.registrar).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entidad: 'VinculacionPuestoCentro',
          accion: 'CREATE',
          entidadId: '10:p-amolador:c-ypf',
        }),
      );
      expect(audit.registrar).not.toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ entidadId: '10:p-soldador:c-ypf' }),
      );
    });

    it('sacar un par genera un DELETE de ese par', async () => {
      prisma.usuario.findFirst.mockResolvedValue(usuarioConVinculacion());
      prisma.usuario.update.mockResolvedValue(usuarioConVinculacion());
      prisma.puesto.findMany.mockResolvedValue([{ id: 'p-soldador' }]);
      prisma.centroCosto.findMany.mockResolvedValue([{ id: 'c-ypf' }]);
      const parQueQueda = {
        puestoId: 'p-soldador',
        centroCostoId: 'c-ypf',
        principal: true,
        activo: true,
      };
      const parQueSeVa = {
        puestoId: 'p-amolador',
        centroCostoId: 'c-ypf',
        principal: false,
        activo: true,
      };
      prisma.vinculacion.findUnique
        .mockResolvedValueOnce({
          id: 10,
          usuarioId: 1,
          organizacionId: 1,
          rol: RolUsuario.ALUMNO,
          activa: true,
          puestosCentros: [parQueQueda, parQueSeVa],
        })
        .mockResolvedValueOnce({
          id: 10,
          usuarioId: 1,
          organizacionId: 1,
          rol: RolUsuario.ALUMNO,
          activa: true,
          puestosCentros: [parQueQueda],
        });

      await service.update(1, {
        vinculacion: {
          pares: [{ puestoId: 'p-soldador', centroCostoId: 'c-ypf' }],
        },
      });

      expect(audit.registrar).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entidad: 'VinculacionPuestoCentro',
          accion: 'DELETE',
          entidadId: '10:p-amolador:c-ypf',
        }),
      );
    });

    it('un par que se desactiva pero sigue existiendo genera UPDATE, no DELETE', async () => {
      // El caso concreto que motiva leer el "después" simétrico al "antes"
      // (tx.vinculacion.findUnique explícito, no actualizado.vinculacion de
      // USUARIO_INCLUDE): si el "después" viniera filtrado por activo: true,
      // este par desaparecería del array y se leería como borrado.
      prisma.usuario.findFirst.mockResolvedValue(usuarioConVinculacion());
      prisma.usuario.update.mockResolvedValue(usuarioConVinculacion());
      prisma.puesto.findMany.mockResolvedValue([{ id: 'p-soldador' }]);
      prisma.centroCosto.findMany.mockResolvedValue([{ id: 'c-ypf' }]);
      prisma.vinculacion.findUnique
        .mockResolvedValueOnce({
          id: 10,
          usuarioId: 1,
          organizacionId: 1,
          rol: RolUsuario.ALUMNO,
          activa: true,
          puestosCentros: [
            {
              puestoId: 'p-soldador',
              centroCostoId: 'c-ypf',
              principal: true,
              activo: true,
            },
          ],
        })
        .mockResolvedValueOnce({
          id: 10,
          usuarioId: 1,
          organizacionId: 1,
          rol: RolUsuario.ALUMNO,
          activa: true,
          puestosCentros: [
            {
              puestoId: 'p-soldador',
              centroCostoId: 'c-ypf',
              principal: true,
              activo: false,
            },
          ],
        });

      await service.update(1, {
        vinculacion: {
          pares: [{ puestoId: 'p-soldador', centroCostoId: 'c-ypf' }],
        },
      });

      expect(audit.registrar).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entidad: 'VinculacionPuestoCentro',
          accion: 'UPDATE',
          entidadId: '10:p-soldador:c-ypf',
          diff: { activo: { antes: true, despues: false } },
        }),
      );
      expect(audit.registrar).not.toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entidadId: '10:p-soldador:c-ypf',
          accion: 'DELETE',
        }),
      );
    });

    it('mandar los mismos pares no genera ningún log de VinculacionPuestoCentro', async () => {
      prisma.usuario.findFirst.mockResolvedValue(usuarioConVinculacion());
      prisma.usuario.update.mockResolvedValue(usuarioConVinculacion());
      prisma.puesto.findMany.mockResolvedValue([{ id: 'p-soldador' }]);
      prisma.centroCosto.findMany.mockResolvedValue([{ id: 'c-ypf' }]);
      const par = {
        puestoId: 'p-soldador',
        centroCostoId: 'c-ypf',
        principal: true,
        activo: true,
      };
      const vinc = {
        id: 10,
        usuarioId: 1,
        organizacionId: 1,
        rol: RolUsuario.ALUMNO,
        activa: true,
        puestosCentros: [par],
      };
      prisma.vinculacion.findUnique
        .mockResolvedValueOnce(vinc)
        .mockResolvedValueOnce(vinc);

      await service.update(1, {
        vinculacion: {
          pares: [{ puestoId: 'p-soldador', centroCostoId: 'c-ypf' }],
        },
      });

      expect(audit.registrar).not.toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ entidad: 'VinculacionPuestoCentro' }),
      );
    });

    it('un update que no cambia nada no genera ningún log', async () => {
      const vinc = {
        id: 10,
        usuarioId: 1,
        organizacionId: 1,
        rol: RolUsuario.ALUMNO,
        activa: true,
        puestosCentros: [],
      };
      prisma.usuario.findFirst.mockResolvedValue(usuarioConVinculacion());
      prisma.usuario.update.mockResolvedValue(usuarioConVinculacion());
      prisma.vinculacion.findUnique
        .mockResolvedValueOnce(vinc)
        .mockResolvedValueOnce(vinc);

      await service.update(1, { nombre: 'Ana María' }); // no toca la vinculación

      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it('remove() genera un DELETE de Vinculacion', async () => {
      prisma.usuario.findFirst.mockResolvedValue({ id: 3, vinculacion: null });
      prisma.usuario.update.mockResolvedValue({ id: 3, deletedAt: new Date() });
      prisma.vinculacion.findUnique.mockResolvedValue({
        id: 20,
        usuarioId: 3,
        organizacionId: 1,
        rol: RolUsuario.ALUMNO,
        activa: true,
        puestosCentros: [],
      });

      await service.remove(3);

      expect(audit.registrar).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entidad: 'Vinculacion',
          entidadId: '20',
          accion: 'DELETE',
          actor: 'backoffice',
        }),
      );
    });
  });
});
