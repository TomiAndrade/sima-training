import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SesionesService } from '../sesiones/sesiones.service';
import { UsuariosService } from './usuarios.service';

// El informe orquesta cuatro fuentes ya existentes (findOne, AsignacionesService,
// SesionesService, AuditService) y el veredicto que se arma con lo que trae
// AsignacionesService.findByUsuario(). No reprueba la jerarquía de
// calcularVeredicto() — eso ya lo cubre asignaciones/veredicto.spec.ts — sólo que
// el mapeo a AsignacionParaVeredicto sea el correcto.
describe('UsuariosService.informe', () => {
  let service: UsuariosService;
  let prisma: { usuario: { findFirst: jest.Mock } };
  let asignaciones: { findByUsuario: jest.Mock };
  let sesiones: { listarPorUsuario: jest.Mock };
  let audit: { listarPorUsuario: jest.Mock };

  const usuario = {
    id: 1,
    nombre: 'Ana',
    apellido: 'Paz',
    dni: '30111222',
    vinculacion: null,
  };

  beforeEach(async () => {
    prisma = { usuario: { findFirst: jest.fn() } };
    asignaciones = { findByUsuario: jest.fn() };
    sesiones = { listarPorUsuario: jest.fn() };
    audit = { listarPorUsuario: jest.fn() };

    prisma.usuario.findFirst.mockResolvedValue(usuario);
    asignaciones.findByUsuario.mockResolvedValue([]);
    sesiones.listarPorUsuario.mockResolvedValue([]);
    audit.listarPorUsuario.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AsignacionesService, useValue: asignaciones },
        { provide: AuditService, useValue: audit },
        { provide: SesionesService, useValue: sesiones },
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  it('404 si el usuario no existe — mismo chequeo que findOne(), y no llega a pedir las otras tres fuentes', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);

    await expect(service.informe(99)).rejects.toBeInstanceOf(NotFoundException);
    expect(asignaciones.findByUsuario).not.toHaveBeenCalled();
    expect(sesiones.listarPorUsuario).not.toHaveBeenCalled();
    expect(audit.listarPorUsuario).not.toHaveBeenCalled();
  });

  it('junta las cuatro fuentes en un solo objeto', async () => {
    const asignacionesData = [
      {
        id: 'a1',
        revocadaAt: null,
        modulo: { id: 'm1', nombre: 'SIMA Básico', vigenciaMeses: null },
        vencimiento: { estado: 'VIGENTE', aprobadaEn: null, venceEl: null },
      },
    ];
    const sesionesData = [{ id: 's1', aprobada: true }];
    const auditLogData = [{ id: 'l1', entidad: 'Vinculacion' }];
    asignaciones.findByUsuario.mockResolvedValue(asignacionesData);
    sesiones.listarPorUsuario.mockResolvedValue(sesionesData);
    audit.listarPorUsuario.mockResolvedValue(auditLogData);

    const informe = await service.informe(1);

    expect(informe.asignaciones).toBe(asignacionesData);
    expect(informe.sesiones).toBe(sesionesData);
    expect(informe.auditLog).toBe(auditLogData);
    expect(informe.usuario).toMatchObject({ id: 1, dni: '30111222' });
    expect(asignaciones.findByUsuario).toHaveBeenCalledWith(1);
    expect(sesiones.listarPorUsuario).toHaveBeenCalledWith(1);
    expect(audit.listarPorUsuario).toHaveBeenCalledWith(1);
  });

  it('todas VIGENTE: el veredicto da EN_REGLA', async () => {
    asignaciones.findByUsuario.mockResolvedValue([
      {
        id: 'a1',
        revocadaAt: null,
        modulo: { id: 'm1', nombre: 'SIMA Básico', vigenciaMeses: null },
        vencimiento: { estado: 'VIGENTE', aprobadaEn: null, venceEl: null },
      },
    ]);

    const informe = await service.informe(1);

    expect(informe.veredicto).toEqual({
      estado: 'EN_REGLA',
      asignacion: null,
    });
  });

  it('una VENCIDO: el veredicto da NO_HABILITADO y apunta al módulo por su nombre', async () => {
    asignaciones.findByUsuario.mockResolvedValue([
      {
        id: 'a1',
        revocadaAt: null,
        modulo: { id: 'm1', nombre: 'SIMA Básico', vigenciaMeses: 12 },
        vencimiento: {
          estado: 'VENCIDO',
          aprobadaEn: new Date(),
          venceEl: new Date(),
        },
      },
    ]);

    const informe = await service.informe(1);

    expect(informe.veredicto).toEqual({
      estado: 'NO_HABILITADO',
      asignacion: { id: 'a1', moduloNombre: 'SIMA Básico' },
    });
  });

  it('sin asignaciones: SIN_OBLIGACIONES', async () => {
    asignaciones.findByUsuario.mockResolvedValue([]);

    const informe = await service.informe(1);

    expect(informe.veredicto).toEqual({
      estado: 'SIN_OBLIGACIONES',
      asignacion: null,
    });
  });
});
