import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { Auth0VerifierService } from './auth0-verifier.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

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
    Auth0VerifierService,
    JwtAuthGuard,
    RolesGuard,
    // Guard global (Story 4): antes de esto, auth era 100% opt-in por ruta
    // (@UseGuards(JwtAuthGuard) puesto a mano en ~40 lugares). Con esto,
    // CUALQUIER ruta nueva queda cerrada por default — necesita @Public()
    // explícito para abrirse, no al revés. Ver public.decorator.ts.
    //
    // El JwtModule sigue acá aunque el backoffice ya no emita tokens propios
    // (se fue POST /auth/login, cleanup post-Auth0): TabletService lo sigue
    // usando para firmar los tokens `tipo: 'alumno'` de la app tablet, con
    // el mismo JWT_SECRET.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Segundo guard global, y el ORDEN IMPORTA: Nest los corre en el orden en
    // que se registran, y RolesGuard lee `request.usuario` — la identidad que
    // deja JwtAuthGuard al resolver el token contra Usuario+Vinculacion. Si
    // se invierten, `request.usuario` viene undefined y TODAS las rutas
    // autenticadas responden 403. Es una inversión fácil de cometer moviendo
    // líneas y barata de detectar: cualquier request autenticado falla.
    //
    // Fail-closed: sin @Roles() no pasa nadie, administradores incluidos. Por
    // eso los 61 endpoints detrás del guard se decoraron en el mismo commit
    // que esta línea, y por eso existe roles-cobertura.spec.ts.
    { provide: APP_GUARD, useClass: RolesGuard },
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
