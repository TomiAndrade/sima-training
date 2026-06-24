import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { sign: () => 'fake.jwt.token' } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'AUTH_USER' ? 'admin@sima.com' : 'sima1234',
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('devuelve token con credenciales válidas', () => {
    const res = service.login({
      usuario: 'admin@sima.com',
      password: 'sima1234',
    });
    expect(res.access_token).toBe('fake.jwt.token');
  });

  it('rechaza credenciales inválidas', () => {
    expect(() =>
      service.login({ usuario: 'admin@sima.com', password: 'mala' }),
    ).toThrow(UnauthorizedException);
  });
});
