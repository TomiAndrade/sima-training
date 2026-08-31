import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsignacionesModule } from '../asignaciones/asignaciones.module';
import { SesionesModule } from '../sesiones/sesiones.module';
import { TabletAuthGuard } from './tablet-auth.guard';
import { TabletController } from './tablet.controller';
import { TabletService } from './tablet.service';

// Módulo aparte y no un controller en sesiones/: lo que sirve la tablet
// compone asignaciones + módulos + sesiones bajo un contrato propio que nunca
// expone `respuestaCorrecta`. El JwtService sale del AuthModule global (no
// hace falta importarlo acá) — el login del backoffice es Auth0 (RS256), un
// mundo aparte de los tokens `tipo: 'alumno'` (HS256) que firma TabletService.
//
// Importa AsignacionesModule (no ModulosModule: la consulta de módulo +
// versión ACTIVO de pendientes()/examen() va por Prisma directo, mismo
// criterio que SesionesService con `pregunta`) y SesionesModule (Commit 4:
// TabletService.rendir() delega TODA la corrección/idempotencia en
// SesionesService.registrar(), no la reimplementa). No hay ciclo: ni
// Asignaciones ni Sesiones importan Tablet.
@Module({
  imports: [AsignacionesModule, SesionesModule],
  controllers: [TabletController],
  providers: [TabletService, TabletAuthGuard],
})
export class TabletModule implements OnModuleInit {
  private readonly logger = new Logger(TabletModule.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.config.get<string>('TABLET_LOGIN_SIN_PIN') !== 'false') {
      this.logger.warn(
        'TABLET_LOGIN_SIN_PIN activo: el login de la tablet valida sólo DNI, sin PIN. ' +
          'Ver docs/autenticacion-tablet.md.',
      );
    }
  }
}
