import { CategoriaEtiqueta } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateEtiquetaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre!: string;

  @IsEnum(CategoriaEtiqueta)
  categoria!: CategoriaEtiqueta;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;
}
