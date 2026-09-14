import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OrganizacionesController } from './organizaciones.controller';
import { OrganizacionesService } from './organizaciones.service';

@Module({
  imports: [AuditModule],
  controllers: [OrganizacionesController],
  providers: [OrganizacionesService],
  exports: [OrganizacionesService],
})
export class OrganizacionesModule {}
