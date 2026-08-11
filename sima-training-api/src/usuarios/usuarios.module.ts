import { Module } from '@nestjs/common';
import { AsignacionesModule } from '../asignaciones/asignaciones.module';
import { AuditModule } from '../audit/audit.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

// Importa AsignacionesModule para que UsuariosService pueda enganchar el
// recálculo de asignaciones AUTOMATICA cuando cambian los pares de un usuario,
// y AuditModule para que registre el historial de cambios de Vinculacion y sus
// pares (Story 9). Las dos aristas son de una sola vía (ninguno de los dos
// importa Usuarios), así que no hace falta forwardRef.
@Module({
  imports: [AsignacionesModule, AuditModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
