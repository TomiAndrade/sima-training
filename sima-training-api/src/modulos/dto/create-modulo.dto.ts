import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { ParametrosExamenDto } from './parametros-examen.dto';

// Hereda los parámetros de examen (preguntasPorExamen, umbralAprobacion,
// maxIntentos, esperaEntreIntentosMinutos): son campos de la VERSIÓN, no del
// módulo, y el service los desvía a la v1 BORRADOR que crea junto con él.
export class CreateModuloDto extends ParametrosExamenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  // Cada cuántos meses debe recertificarse un alumno en este módulo. Opcional.
  // Este SÍ es del módulo (contenedor), a diferencia de los heredados de arriba.
  @IsOptional()
  @IsInt()
  @Min(1)
  vigenciaMeses?: number;
}
