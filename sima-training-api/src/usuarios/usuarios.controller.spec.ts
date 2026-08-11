import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

describe('UsuariosController.auditLog', () => {
  let controller: UsuariosController;
  let audit: { listarPorUsuario: jest.Mock };

  beforeEach(async () => {
    audit = { listarPorUsuario: jest.fn() };

    // create/update/remove llevan @UseGuards(JwtAuthGuard), que depende de
    // JwtService — Nest necesita poder resolverlo al compilar el módulo de
    // test aunque estos tests no pasen por esas rutas. Se reemplaza por un
    // guard trivial en vez de armar un JwtModule real (mismo patrón que
    // tablet.controller.spec.ts con TabletAuthGuard).
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsuariosController],
      providers: [
        { provide: UsuariosService, useValue: {} },
        { provide: AuditService, useValue: audit },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(UsuariosController);
  });

  it('responde con lo que devuelve AuditService.listarPorUsuario y le pasa el id', async () => {
    const logs = [{ id: 'l1', entidad: 'Vinculacion', entidadId: '10' }];
    audit.listarPorUsuario.mockResolvedValue(logs);

    const result = await controller.auditLog(5);

    expect(audit.listarPorUsuario).toHaveBeenCalledWith(5);
    expect(result).toBe(logs);
  });

  it('propaga el NotFoundException que tira el service si el usuario no existe', async () => {
    audit.listarPorUsuario.mockRejectedValue(
      new NotFoundException('Usuario 99 no encontrado'),
    );

    await expect(controller.auditLog(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
