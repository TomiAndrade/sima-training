import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Sprint 1: valida contra credenciales de entorno (sin roles).
  // Migra a Usuario + Vinculacion cuando esas entidades existan.
  login(dto: LoginDto) {
    const expectedUser = this.config.get<string>('AUTH_USER');
    const expectedPass = this.config.get<string>('AUTH_PASSWORD');

    if (dto.usuario !== expectedUser || dto.password !== expectedPass) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = { sub: dto.usuario, type: 'backoffice' };
    return {
      access_token: this.jwt.sign(payload),
      usuario: dto.usuario,
    };
  }
}
