import { Module } from '@nestjs/common';
import { AsignacionesModule } from '../asignaciones/asignaciones.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

// Importa AsignacionesModule para que UsuariosService pueda enganchar el
// recálculo de asignaciones AUTOMATICA cuando cambian los pares de un usuario.
// La arista Usuarios → Asignaciones es de una sola vía (Asignaciones no importa
// Usuarios), así que no hace falta forwardRef.
@Module({
  imports: [AsignacionesModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
