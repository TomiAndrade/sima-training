import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Sólo renombra. `orden` NO se edita por acá a propósito: moverlo fila por fila
// viola el índice único (base_conocimiento_id, orden), que no es diferible.
// Reordenar va por PUT /:id/niveles/orden, que reindexa la escala entera.
export class UpdateNivelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nombre!: string;
}
