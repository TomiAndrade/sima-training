import { Type } from 'class-transformer';
import { IsInt, IsUUID } from 'class-validator';

// Alta MANUAL de una asignación (la carga un admin a mano). Las AUTOMATICA no
// pasan por acá: las genera AsignacionesService.recalcular(). El origen queda
// fijado en MANUAL en el service, no se acepta del cliente.
export class CreateAsignacionDto {
  @Type(() => Number)
  @IsInt()
  usuarioId!: number;

  @IsUUID()
  moduloId!: string;
}
