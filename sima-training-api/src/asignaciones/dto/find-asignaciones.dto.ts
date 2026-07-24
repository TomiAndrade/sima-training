import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

// GET /asignaciones?usuarioId= — lista las asignaciones de una persona (vigentes
// y revocadas). usuarioId es obligatorio: no hay un listado global de todas las
// asignaciones de todo el sistema.
export class FindAsignacionesDto {
  @Type(() => Number)
  @IsInt()
  usuarioId!: number;
}
