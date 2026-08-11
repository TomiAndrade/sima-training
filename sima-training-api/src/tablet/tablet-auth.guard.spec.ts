import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TabletAuthGuard } from './tablet-auth.guard';

describe('TabletAuthGuard', () => {
  let guard: TabletAuthGuard;
  let jwt: { verifyAsync: jest.Mock };

  // Arma un ExecutionContext mínimo con el header Authorization pedido, y
  // devuelve también el `request` crudo para poder inspeccionar qué le dejó
  // el guard (`request.user`) después de canActivate().
  const buildContext = (authorization?: string) => {
    const request: { headers: Record<string, string>; user?: unknown } = {
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
      providers: [TabletAuthGuard, { provide: JwtService, useValue: jwt }],
    }).compile();

    guard = module.get(TabletAuthGuard);
  });

  it('rechaza sin token', async () => {
    const { context } = buildContext(undefined);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rechaza un token de backoffice (type: backoffice, no tipo: alumno)', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'admin@sima.com',
      type: 'backoffice',
    });
    const { context } = buildContext('Bearer token-backoffice');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('acepta un token de alumno y deja el usuarioId en request.user', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 7, tipo: 'alumno' });
    const { context, request } = buildContext('Bearer token-alumno');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ sub: 7, tipo: 'alumno' });
  });
});
