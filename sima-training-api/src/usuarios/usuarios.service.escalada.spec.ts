import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RolUsuario, TipoOrganizacion } from '@prisma/client';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SesionesService } from '../sesiones/sesiones.service';
import { UsuariosService } from './usuarios.service';

/**
 * El agujero que `@Roles()` no puede tapar: `PATCH /usuarios/:id` es
 * GESTION_NOMINA (un COORDINADOR tiene que poder editar a su gente), pero el
 * body deja tocar `vinculacion.rol`. Sin el chequeo del service, un
 * coordinador se asciende a ADMINISTRADOR con un curl — editándose a sí
 * mismo, que es el caso que importa.
 *
 * Archivo aparte de usuarios.service.spec.ts por el mismo criterio que
 * usuarios.service.informe.spec.ts: es un eje propio, no un caso más del ABM.
 */
describe('UsuariosService.update — escalada de privilegios', () => {
  let service: UsuariosService;
  let prisma: {
    usuario: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    organizacion: { findUnique: jest.Mock };
    vinculacion: { findUnique: jest.Mock; update: jest.Mock };
    vinculacionPuestoCentro: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };

  // El coordinador de la historia: se edita a sí mismo (id 7).
  const COORDINADOR_EN_BASE = {
    id: 7,
    nombre: 'Ana',
    apellido: 'Paz',
    dni: '30111222',
    vinculacion: {
      id: 70,
      usuarioId: 7,
      organizacionId: 1,
      rol: RolUsuario.COORDINADOR,
      activa: true,
      organizacion: { id: 1, nombre: 'Ingeniería SIMA', tipo: 'INTERNA' },
      puestosCentros: [],
    },
  };

  beforeEach(async () => {
    prisma = {
      usuario: {
        findFirst: jest.fn().mockResolvedValue(COORDINADOR_EN_BASE),
        findUnique: jest.fn().mockResolvedValue(COORDINADOR_EN_BASE),
        update: jest.fn().mockResolvedValue(COORDINADOR_EN_BASE),
      },
      organizacion: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ tipo: TipoOrganizacion.INTERNA }),
      },
      vinculacion: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      vinculacionPuestoCentro: { deleteMany: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AsignacionesService,
          useValue: { recalcularEnTx: jest.fn() },
        },
        { provide: AuditService, useValue: { registrar: jest.fn() } },
        { provide: SesionesService, useValue: {} },
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  it('un COORDINADOR no puede ascenderse a ADMINISTRADOR', async () => {
    await expect(
      service.update(
        7,
        { vinculacion: { rol: RolUsuario.ADMINISTRADOR } },
        undefined,
        RolUsuario.COORDINADOR,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('un COORDINADOR no puede mudar a alguien de organización', async () => {
    await expect(
      service.update(
        7,
        { vinculacion: { organizacionId: 99 } },
        undefined,
        RolUsuario.COORDINADOR,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('un COORDINADOR SÍ puede editar lo demás (nombre, pares)', async () => {
    // El caso normal y el más frecuente: si esto se rompe, el chequeo quedó
    // demasiado ancho y le sacamos al coordinador su trabajo diario.
    await expect(
      service.update(
        7,
        { nombre: 'Ana María' },
        undefined,
        RolUsuario.COORDINADOR,
      ),
    ).resolves.toBeDefined();
  });

  it('reenviar el MISMO rol y organización no es una escalada', async () => {
    // El frontend manda el objeto `vinculacion` entero al editar cualquier
    // campo. Si esto fallara, un coordinador no podría cambiar un par sin
    // comerse un 403 — y el chequeo se volvería inservible en la práctica.
    await expect(
      service.update(
        7,
        {
          vinculacion: {
            rol: RolUsuario.COORDINADOR,
            organizacionId: 1,
          },
        },
        undefined,
        RolUsuario.COORDINADOR,
      ),
    ).resolves.toBeDefined();
  });

  it('un ADMINISTRADOR sí puede cambiar el rol', async () => {
    await expect(
      service.update(
        7,
        { vinculacion: { rol: RolUsuario.ADMINISTRADOR } },
        undefined,
        RolUsuario.ADMINISTRADOR,
      ),
    ).resolves.toBeDefined();
  });

  it('sin actorRol se deniega, no se permite (fail-closed)', async () => {
    await expect(
      service.update(7, { vinculacion: { rol: RolUsuario.ADMINISTRADOR } }),
    ).rejects.toThrow(ForbiddenException);
  });
});
