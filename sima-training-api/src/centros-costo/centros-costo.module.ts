import { Module } from '@nestjs/common';
import { CentrosCostoController } from './centros-costo.controller';
import { CentrosCostoService } from './centros-costo.service';

@Module({
  controllers: [CentrosCostoController],
  providers: [CentrosCostoService],
  exports: [CentrosCostoService],
})
export class CentrosCostoModule {}
