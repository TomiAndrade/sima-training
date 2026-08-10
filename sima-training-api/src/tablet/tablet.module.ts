import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsignacionesModule } from '../asignaciones/asignaciones.module';
import { TabletAuthGuard } from './tablet-auth.guard';
import { TabletController } from './tablet.controller';
import { TabletService } from './tablet.service';

// Módulo aparte y no un controller en sesiones/: lo que sirve la tablet
// compone asignaciones + módulos hoy, y sesiones en el próximo commit (el
// examen), bajo un contrato propio que nunca expone `respuestaCorrecta`. El
// JwtService sale del AuthModule global (no hace falta importarlo acá) y
// AuthService/AuthController del backoffice quedan intactos: son el login
// `type: 'backoffice'`, esto es un mundo aparte.
//
// Importa AsignacionesModule (no ModulosModule: la consulta de módulo +
// versión ACTIVO de pendientes() va por Prisma directo, mismo criterio que
// SesionesService con `pregunta`). No hay ciclo: Asignaciones no importa
// Tablet.
@Module({
  imports: [AsignacionesModule],
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
