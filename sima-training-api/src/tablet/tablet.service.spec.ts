import { NotImplementedException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { TabletService } from './tablet.service';

describe('TabletService', () => {
  let service: TabletService;
  let prisma: {
    usuario: { findFirst: jest.Mock };
    asignacion: { findMany: jest.Mock };
  };
  let jwt: { sign: jest.Mock };
  let config: { get: jest.Mock };
  let asignaciones: { modulosAprobados: jest.Mock };

  beforeEach(async () => {
    prisma = {
      usuario: { findFirst: jest.fn() },
      asignacion: { findMany: jest.fn() },
    };
    jwt = { sign: jest.fn().mockReturnValue('fake.jwt.token') };
    // Sin TABLET_LOGIN_SIN_PIN configurada = default 'true' (login sin PIN
    // habilitado); los tests que necesitan el otro valor lo pisan.
    config = { get: jest.fn().mockReturnValue(undefined) };
    asignaciones = { modulosAprobados: jest.fn().mockResolvedValue(new Set()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TabletService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: AsignacionesService, useValue: asignaciones },
      ],
    }).compile();

    service = module.get(TabletService);
  });

  // --- login ------------------------------------------------------------

  it('rechaza un DNI inexistente', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(service.login({ dni: '99999999' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('un usuario dado de baja se trata como inexistente: el where filtra deletedAt: null', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(service.login({ dni: '11111111' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.usuario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dni: '11111111', deletedAt: null },
      }),
    );
  });

  it('un DNI válido devuelve un token firmado con tipo alumno', async () => {
    prisma.usuario.findFirst.mockResolvedValue({
      id: 7,
      nombre: 'Carlos',
      apellido: 'Ferreyra',
    });

    const res = await service.login({ dni: '22222222' });

    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: 7, tipo: 'alumno' },
      expect.objectContaining({ expiresIn: expect.any(String) }),
    );
    expect(res).toMatchObject({
      access_token: 'fake.jwt.token',
      usuario: { id: 7, nombre: 'Carlos', apellido: 'Ferreyra' },
    });
  });

  it('responde 501 si TABLET_LOGIN_SIN_PIN está en false', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'TABLET_LOGIN_SIN_PIN' ? 'false' : undefined,
    );

    await expect(service.login({ dni: '22222222' })).rejects.toBeInstanceOf(
      NotImplementedException,
    );
    expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
  });

  // --- pendientes ---------------------------------------------------------

  const asignacionRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'asig-1',
    moduloId: 'mod-1',
    modulo: {
      nombre: 'SIMA Básico',
      descripcion: 'Módulo base',
      activo: true,
      versiones: [{ id: 'v1', anio: 2026, mayor: 1, menor: 0 }],
    },
    ...overrides,
  });

  it('devuelve el caso normal con la forma esperada', async () => {
    prisma.asignacion.findMany.mockResolvedValue([asignacionRow()]);

    const res = await service.pendientes(7);

    expect(res).toEqual([
      {
        asignacionId: 'asig-1',
        moduloId: 'mod-1',
        nombre: 'SIMA Básico',
        descripcion: 'Módulo base',
        version: { id: 'v1', anio: 2026, mayor: 1, menor: 0 },
      },
    ]);
  });

  it('excluye módulos ya aprobados', async () => {
    prisma.asignacion.findMany.mockResolvedValue([asignacionRow()]);
    asignaciones.modulosAprobados.mockResolvedValue(new Set(['mod-1']));

    expect(await service.pendientes(7)).toEqual([]);
  });

  it('excluye un módulo sin ninguna versión ACTIVO', async () => {
    prisma.asignacion.findMany.mockResolvedValue([
      asignacionRow({
        modulo: {
          nombre: 'SIMA Básico',
          descripcion: 'Módulo base',
          activo: true,
          versiones: [],
        },
      }),
    ]);

    expect(await service.pendientes(7)).toEqual([]);
  });

  it('excluye un módulo dado de baja (activo: false)', async () => {
    prisma.asignacion.findMany.mockResolvedValue([
      asignacionRow({
        modulo: {
          nombre: 'SIMA Básico',
          descripcion: 'Módulo base',
          activo: false,
          versiones: [{ id: 'v1', anio: 2026, mayor: 1, menor: 0 }],
        },
      }),
    ]);

    expect(await service.pendientes(7)).toEqual([]);
  });

  it('un usuario sin asignaciones devuelve un array vacío, no un error', async () => {
    prisma.asignacion.findMany.mockResolvedValue([]);
    await expect(service.pendientes(7)).resolves.toEqual([]);
  });
});
