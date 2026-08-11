import { Module } from '@nestjs/common';
import { AsignacionesModule } from '../asignaciones/asignaciones.module';
import { AuditModule } from '../audit/audit.module';
import { SesionesModule } from '../sesiones/sesiones.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

// Importa AsignacionesModule para que UsuariosService pueda enganchar el
// recálculo de asignaciones AUTOMATICA cuando cambian los pares de un usuario,
// AuditModule para que registre el historial de cambios de Vinculacion y sus
// pares (Story 9), y SesionesModule para el historial de rendiciones que
// consume GET /usuarios/:id/informe (Story 10). Las tres aristas son de una
// sola vía (ninguno de los tres importa Usuarios), así que no hace falta
// forwardRef.
@Module({
  imports: [AsignacionesModule, AuditModule, SesionesModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
