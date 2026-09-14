import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AsignacionesController } from './asignaciones.controller';
import { AsignacionesService } from './asignaciones.service';
import { ReglasAsignacionController } from './reglas-asignacion.controller';
import { ReglasAsignacionService } from './reglas-asignacion.service';

// Dominio de asignaciones: la regla (par → módulo) y la asignación derivada por
// persona, más el motor recalcular(). Ambas entidades viven en un solo módulo
// porque están acopladas (las reglas generan las asignaciones), igual que
// Vinculacion vive dentro de usuarios/. AuditModule es para que
// ReglasAsignacionService registre el historial de cambios de ReglaAsignacion.
@Module({
  imports: [AuditModule],
  controllers: [ReglasAsignacionController, AsignacionesController],
  providers: [ReglasAsignacionService, AsignacionesService],
  exports: [ReglasAsignacionService, AsignacionesService],
})
export class AsignacionesModule {}
