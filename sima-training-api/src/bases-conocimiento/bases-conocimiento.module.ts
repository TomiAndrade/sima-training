import { Module } from '@nestjs/common';
import { BasesConocimientoController } from './bases-conocimiento.controller';
import { BasesConocimientoService } from './bases-conocimiento.service';

@Module({
  controllers: [BasesConocimientoController],
  providers: [BasesConocimientoService],
  exports: [BasesConocimientoService],
})
export class BasesConocimientoModule {}
