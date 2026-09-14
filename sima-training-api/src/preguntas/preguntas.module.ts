import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ModulosModule } from '../modulos/modulos.module';
import { StorageModule } from '../storage/storage.module';
import { PreguntasController } from './preguntas.controller';
import { PreguntasService } from './preguntas.service';

@Module({
  imports: [ModulosModule, StorageModule, AuditModule],
  controllers: [PreguntasController],
  providers: [PreguntasService],
  exports: [PreguntasService],
})
export class PreguntasModule {}
