import { Module } from '@nestjs/common';
import { ModulosModule } from '../modulos/modulos.module';
import { StorageModule } from '../storage/storage.module';
import { PreguntasController } from './preguntas.controller';
import { PreguntasService } from './preguntas.service';

@Module({
  imports: [ModulosModule, StorageModule],
  controllers: [PreguntasController],
  providers: [PreguntasService],
  exports: [PreguntasService],
})
export class PreguntasModule {}
