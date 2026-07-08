import { Module } from '@nestjs/common';
import { ModulosModule } from '../modulos/modulos.module';
import { PreguntasModule } from '../preguntas/preguntas.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [PreguntasModule, ModulosModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
