import { CategoriaEtiqueta } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

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

  // ?activa=true / ?activa=false — papelera (false) vs activas (true) a nivel
  // banco. Sin el @Transform, class-validator recibe el string crudo.
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  activa?: boolean;

  // Acepta ?moduloId=a&moduloId=b (llega como array) o ?moduloId=a (llega
  // como string) y normaliza siempre a array.
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsUUID('4', { each: true })
  moduloId?: string[];

  // ?sinAsignar=true — preguntas sin ninguna asignación a la versión vigente
  // de ningún módulo. Se combina con moduloId como OR (ver PreguntasService).
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  sinAsignar?: boolean;
}
