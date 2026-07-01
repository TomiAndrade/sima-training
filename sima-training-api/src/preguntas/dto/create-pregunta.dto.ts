import { TipoPregunta } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePreguntaDto {
  @IsString()
  @IsNotEmpty()
  texto!: string;

  @IsEnum(TipoPregunta)
  tipo!: TipoPregunta;

  // Array de strings (texto de opciones o rutas de imagen). Solo aplica a
  // OPCION_MULTIPLE / OPCIONES_IMAGEN.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  opciones?: string[];

  @IsOptional()
  @IsString()
  respuestaCorrecta?: string;

  @IsOptional()
  @IsString()
  imagen?: string;

  @IsOptional()
  @IsInt()
  puntajeMax?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  // Etiquetas a asociar en la creación (ids existentes).
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  etiquetaIds?: string[];
}
