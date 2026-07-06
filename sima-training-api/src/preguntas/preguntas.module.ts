import { Module } from '@nestjs/common';
import { ModulosModule } from '../modulos/modulos.module';
import { PreguntasController } from './preguntas.controller';
import { PreguntasService } from './preguntas.service';

@Module({
  imports: [ModulosModule],
  controllers: [PreguntasController],
  providers: [PreguntasService],
  exports: [PreguntasService],
})
export class PreguntasModule {}
