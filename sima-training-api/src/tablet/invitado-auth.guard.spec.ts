import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { InvitadoAuthGuard } from './invitado-auth.guard';

describe('InvitadoAuthGuard', () => {
  let guard: InvitadoAuthGuard;
  let jwt: { verifyAsync: jest.Mock };

  const buildContext = (authorization?: string) => {
    const request: { headers: Record<string, string>; invitado?: unknown } = {
      headers: authorization ? { authorization } : {},
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  beforeEach(async () => {
    jwt = { verifyAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [InvitadoAuthGuard, { provide: JwtService, useValue: jwt }],
    }).compile();

    guard = module.get(InvitadoAuthGuard);
  });

  it('rechaza sin token', async () => {
    const { context } = buildContext(undefined);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rechaza un header que no es Bearer', async () => {
    const { context } = buildContext('Basic abc123');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza un token inválido o expirado', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const { context } = buildContext('Bearer vencido');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  // El cruce que justifica que sean dos guards y no uno: un token de alumno es
  // criptográficamente válido (mismo secreto), y aun así no entra acá.
  it('rechaza un token de ALUMNO', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 7, tipo: 'alumno' });
    const { context } = buildContext('Bearer token-alumno');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza un token de backoffice', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'admin@sima.com',
      type: 'backoffice',
    });
    const { context } = buildContext('Bearer token-backoffice');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  // Un nombre en blanco terminaría como una fila anónima en el reporte, que es
  // exactamente lo que el modo quiere evitar. El DTO ya lo bloquea al emitir,
  // pero el guard no confía en eso: un token viejo o manipulado no pasa.
  it('rechaza un token de invitado con nombre vacío o en blanco', async () => {
    for (const nombre of ['', '   ']) {
      jwt.verifyAsync.mockResolvedValue({ tipo: 'invitado', nombre });
      const { context } = buildContext('Bearer token-sin-nombre');

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
  });

  it('acepta un token de invitado y deja el nombre en request.invitado', async () => {
    jwt.verifyAsync.mockResolvedValue({ tipo: 'invitado', nombre: 'Juan' });
    const { context, request } = buildContext('Bearer token-invitado');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.invitado).toEqual({ tipo: 'invitado', nombre: 'Juan' });
  });

  // El payload de invitado NO tiene `sub`, y eso no es un olvido: es lo que hace
  // estructuralmente imposible que este token pida los datos de un usuario real.
  it('acepta un invitado aunque no tenga sub', async () => {
    jwt.verifyAsync.mockResolvedValue({ tipo: 'invitado', nombre: 'Ana' });
    const { context, request } = buildContext('Bearer token-invitado');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.invitado).not.toHaveProperty('sub');
  });
});
