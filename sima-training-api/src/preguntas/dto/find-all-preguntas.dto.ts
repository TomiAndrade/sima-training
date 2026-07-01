import { CategoriaEtiqueta } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class FindAllPreguntasDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID('4')
  etiqueta?: string;

  @IsOptional()
  @IsEnum(CategoriaEtiqueta)
  categoria?: CategoriaEtiqueta;
}
