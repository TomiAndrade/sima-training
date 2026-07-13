import { IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreateModuloDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  // Cada cuántos meses debe recertificarse un alumno en este módulo. Opcional.
  @IsOptional()
  @IsInt()
  @Min(1)
  vigenciaMeses?: number;
}
