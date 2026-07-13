import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';

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
}
