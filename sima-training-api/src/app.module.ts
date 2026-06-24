import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { ImportModule } from './import/import.module';
import { OrganizacionesModule } from './organizaciones/organizaciones.module';
import { PrismaModule } from './prisma/prisma.module';
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
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
