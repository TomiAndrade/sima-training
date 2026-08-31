import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwksClient } from 'jwks-rsa';

// Claim namespaced que agrega la Post-Login Action de Auth0 (dashboard, no
// código de este repo) al access token — un access token de una API custom
// no trae `email` por default. Ver docs/decisiones o el plan de Story 4 para
// el código exacto de la Action.
export const AUTH0_EMAIL_CLAIM = 'https://sima-training/email';

export interface Auth0Payload {
  sub: string;
  [AUTH0_EMAIL_CLAIM]?: string;
  [key: string]: unknown;
}

// Falla al construir el módulo y no en el primer login: un deploy sin
// AUTH0_DOMAIN/AUTH0_AUDIENCE tiene que morir al arrancar, mismo criterio
// que R2Storage con sus credenciales (src/storage/r2.storage.ts).
function requerido(config: ConfigService, clave: string): string {
  const valor = config.get<string>(clave);
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${clave} (requerida para Auth0)`,
    );
  }
  return valor;
}

/**
 * Verifica un access token RS256 emitido por Auth0: firma contra la clave
 * pública correspondiente (JWKS, cacheado), issuer y audience. No sabe nada
 * de `Usuario`/`Vinculacion` — eso lo resuelve JwtAuthGuard después de
 * verificar. Separado del guard para no mezclar "el token es válido" con
 * "a quién representa en esta base".
 */
@Injectable()
export class Auth0VerifierService {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: JwksClient;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    const domain = requerido(config, 'AUTH0_DOMAIN');
    this.audience = requerido(config, 'AUTH0_AUDIENCE');
    this.issuer = `https://${domain}/`;
    this.jwks = new JwksClient({
      jwksUri: `https://${domain}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
    });
  }

  async verificar(token: string): Promise<Auth0Payload> {
    const decodificado = this.jwt.decode(token, { complete: true }) as {
      header?: { kid?: string };
    } | null;
    const kid = decodificado?.header?.kid;
    if (!kid) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    try {
      const clave = await this.jwks.getSigningKey(kid);
      const payload = await this.jwt.verifyAsync<Auth0Payload>(token, {
        secret: clave.getPublicKey(),
        algorithms: ['RS256'],
        issuer: this.issuer,
        audience: this.audience,
      });
      return payload;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
