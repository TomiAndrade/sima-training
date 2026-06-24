import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { OrganizacionesModule } from './organizaciones/organizaciones.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    OrganizacionesModule,
    UsuariosModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
