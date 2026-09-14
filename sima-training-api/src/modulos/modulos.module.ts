import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ModulosController } from './modulos.controller';
import { ModulosService } from './modulos.service';

@Module({
  imports: [AuditModule],
  controllers: [ModulosController],
  providers: [ModulosService],
  exports: [ModulosService],
})
export class ModulosModule {}
