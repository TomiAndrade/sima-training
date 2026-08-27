import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SentryModule } from '@sentry/nestjs/setup';
import { AsignacionesModule } from './asignaciones/asignaciones.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BasesConocimientoModule } from './bases-conocimiento/bases-conocimiento.module';
import { CentrosCostoModule } from './centros-costo/centros-costo.module';
import { EstadisticasModule } from './estadisticas/estadisticas.module';
import { HealthController } from './health/health.controller';
import { ImportModule } from './import/import.module';
import { ModulosModule } from './modulos/modulos.module';
import { RequestIdMiddleware } from './observabilidad/request-id.middleware';
import { OrganizacionesModule } from './organizaciones/organizaciones.module';
import { PreguntasModule } from './preguntas/preguntas.module';
import { PrismaModule } from './prisma/prisma.module';
import { PuestosModule } from './puestos/puestos.module';
import { SesionesModule } from './sesiones/sesiones.module';
import { TabletModule } from './tablet/tablet.module';
import { ResumenModule } from './resumen/resumen.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    // Wiring de base del SDK (requerido por la doc de @sentry/nestjs), primero
    // en la lista. La captura de excepciones NO sale de acá: es manual, sólo
    // para 5xx, desde GlobalExceptionFilter — ver la nota ahí.
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    OrganizacionesModule,
    AuditModule,
    UsuariosModule,
    ImportModule,
    BasesConocimientoModule,
    PreguntasModule,
    ModulosModule,
    PuestosModule,
    CentrosCostoModule,
    AsignacionesModule,
    SesionesModule,
    TabletModule,
    ResumenModule,
    EstadisticasModule,
  ],
  controllers: [HealthController],
  providers: [],
})
// `observabilidad/` no tiene su propio *.module.ts a propósito: nada ahí
// necesita DI hoy (el middleware no inyecta nada, el logger/filtro/interceptor
// se instancian con `new` en main.ts). Si el día de mañana necesitan inyectar
// algo (ej. un cliente de Sentry), ahí conviene migrar a un módulo real con
// APP_FILTER/APP_INTERCEPTOR — hasta entonces, cablearlo acá y en main.ts es
// más simple.
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Wildcard nombrado: Nest 11 usa Express 5 (path-to-regexp v8), que ya no
    // acepta el `'*'` bare — tira "Unsupported route path" al arrancar.
    consumer.apply(RequestIdMiddleware).forRoutes('{*splat}');
  }
}
