import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CentrosCostoModule } from './centros-costo/centros-costo.module';
import { EtiquetasModule } from './etiquetas/etiquetas.module';
import { HealthController } from './health/health.controller';
import { ImportModule } from './import/import.module';
import { ModulosModule } from './modulos/modulos.module';
import { OrganizacionesModule } from './organizaciones/organizaciones.module';
import { PreguntasModule } from './preguntas/preguntas.module';
import { PrismaModule } from './prisma/prisma.module';
import { PuestosModule } from './puestos/puestos.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    OrganizacionesModule,
    UsuariosModule,
    ImportModule,
    EtiquetasModule,
    PreguntasModule,
    ModulosModule,
    PuestosModule,
    CentrosCostoModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
