import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '@prisma/client';
import { IS_PUBLIC_KEY } from './public.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  // El Reflector devuelve metadata según la clave que le piden; cada test
  // arma su combinación de (¿pública?, ¿qué roles declara?).
  const metadata = (opciones: {
    publica?: boolean;
    roles?: RolUsuario[] | undefined;
  }) => {
    reflector.getAllAndOverride.mockImplementation((clave: string) =>
      clave === IS_PUBLIC_KEY ? opciones.publica : opciones.roles,
    );
  };

  const contexto = (rol?: RolUsuario) =>
    ({
      getHandler: () => jest.fn(),
      getClass: () => class Fake {},
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/ruta',
          usuario: rol ? { rol } : undefined,
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
    // El guard loguea las rutas sin decorar con Logger.error; en los tests es
    // ruido en la salida, no una falla.
    jest.spyOn(guard['logger'], 'error').mockImplementation(() => undefined);
  });

  it('deja pasar una ruta @Public() sin mirar roles ni identidad', () => {
    // El caso de las 10 rutas públicas: /health, /uploads/* y los dos flujos
    // de la tablet, que no tienen ningún `request.usuario` que mirar.
    metadata({ publica: true, roles: undefined });

    expect(guard.canActivate(contexto())).toBe(true);
  });

  it('DENIEGA una ruta sin @Roles() aunque sea administrador (fail-closed)', () => {
    metadata({ publica: undefined, roles: undefined });

    expect(() => guard.canActivate(contexto(RolUsuario.ADMINISTRADOR))).toThrow(
      ForbiddenException,
    );
  });

  it('deniega también con @Roles() vacío', () => {
    metadata({ publica: undefined, roles: [] });

    expect(() => guard.canActivate(contexto(RolUsuario.ADMINISTRADOR))).toThrow(
      ForbiddenException,
    );
  });

  it('deja pasar cuando el rol está entre los declarados', () => {
    metadata({
      publica: undefined,
      roles: [RolUsuario.ADMINISTRADOR, RolUsuario.COORDINADOR],
    });

    expect(guard.canActivate(contexto(RolUsuario.COORDINADOR))).toBe(true);
  });

  it('deniega cuando el rol no está entre los declarados', () => {
    metadata({ publica: undefined, roles: [RolUsuario.ADMINISTRADOR] });

    expect(() => guard.canActivate(contexto(RolUsuario.AUDITOR))).toThrow(
      ForbiddenException,
    );
  });

  it('deniega si no hay identidad en el request', () => {
    // Es el síntoma de tener los dos APP_GUARD registrados al revés:
    // `request.usuario` lo setea JwtAuthGuard, y si corre después de éste,
    // acá no hay nada que mirar. Falla cerrado, no abierto.
    metadata({ publica: undefined, roles: [RolUsuario.ADMINISTRADOR] });

    expect(() => guard.canActivate(contexto(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
