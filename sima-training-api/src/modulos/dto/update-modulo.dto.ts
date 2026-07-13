import { IsBoolean, IsInt, IsOptional, IsString, IsNotEmpty, Min, MaxLength } from 'class-validator';

// Edición de metadata del módulo (contenedor). El contenido/preguntas se maneja por versión.
export class UpdateModuloDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  // Baja lógica del módulo entero, independiente del estado de sus versiones.
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // Cada cuántos meses debe recertificarse un alumno en este módulo.
  @IsOptional()
  @IsInt()
  @Min(1)
  vigenciaMeses?: number;
}
