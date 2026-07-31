import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateBaseConocimientoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  // Código corto para labels compactos y para el import de Excel ("RES").
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigo?: string;

  // Qué entra y qué no en esta base. No es decorativo: es lo que permite
  // decidir sin dudar a cuál de dos bases parecidas va una pregunta nueva.
  @IsOptional()
  @IsString()
  descripcion?: string;

  // De qué manual/revisión sale el temario hoy. Se copia a Pregunta.fuente al
  // crear una pregunta y ahí queda congelada.
  @IsOptional()
  @IsString()
  fuente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
