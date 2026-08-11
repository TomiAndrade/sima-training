import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AsignacionesModule } from './asignaciones/asignaciones.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BasesConocimientoModule } from './bases-conocimiento/bases-conocimiento.module';
import { CentrosCostoModule } from './centros-costo/centros-costo.module';
import { HealthController } from './health/health.controller';
import { ImportModule } from './import/import.module';
import { ModulosModule } from './modulos/modulos.module';
import { OrganizacionesModule } from './organizaciones/organizaciones.module';
import { PreguntasModule } from './preguntas/preguntas.module';
import { PrismaModule } from './prisma/prisma.module';
import { PuestosModule } from './puestos/puestos.module';
import { SesionesModule } from './sesiones/sesiones.module';
import { TabletModule } from './tablet/tablet.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
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
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
