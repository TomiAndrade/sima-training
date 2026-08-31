import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Auth0VerifierService } from './auth0-verifier.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-secret',
        signOptions: {
          // jsonwebtoken tipa expiresIn como StringValue (template literal);
          // el valor viene de env como string genérico.
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '8h') as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    Auth0VerifierService,
    JwtAuthGuard,
    // Guard global (Story 4): antes de esto, auth era 100% opt-in por ruta
    // (@UseGuards(JwtAuthGuard) puesto a mano en ~40 lugares). Con esto,
    // CUALQUIER ruta nueva queda cerrada por default — necesita @Public()
    // explícito para abrirse, no al revés. Ver public.decorator.ts.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  // Auth0VerifierService tiene que estar acá: @Global() sólo hace visibles
  // los providers EXPORTADOS. JwtAuthGuard se sigue resolviendo por ruta
  // (@UseGuards(JwtAuthGuard) en cada controller, no sólo vía APP_GUARD), y
  // Nest arma esa instancia en el contexto del módulo que la pide — sin este
  // export, cualquier controller fuera de AuthModule no puede resolver la
  // dependencia y el arranque entero falla (UnknownDependenciesException).
  exports: [JwtAuthGuard, JwtModule, Auth0VerifierService],
})
export class AuthModule {}
