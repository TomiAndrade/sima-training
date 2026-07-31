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

  // Clave de storage devuelta por POST /preguntas/imagen, o una ruta relativa
  // a public/ si vino del import de Excel (formato legacy, ver imagenUrl() en
  // el backoffice). Inmutable una vez creada la pregunta: no hay endpoint que
  // la cambie, porque todas las versiones de módulo comparten el preguntaId y
  // las ARCHIVADO deben seguir mostrando lo que se rindió.
  @IsOptional()
  @IsString()
  imagen?: string;

  @IsOptional()
  @IsInt()
  puntajeMax?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  // Clasificación. Opcionales a nivel DTO aunque el formulario del backoffice
  // las exija: el import de Excel y las preguntas legacy pueden no traerlas, y
  // la columna es nullable justamente para poder migrar el banco de a poco.
  // Que el nivel pertenezca a la base lo garantiza una FK compuesta en la base
  // de datos, no una validación acá.
  @IsOptional()
  @IsUUID('4')
  baseConocimientoId?: string;

  @IsOptional()
  @IsUUID('4')
  nivelId?: string;

  // Si no viene, se copia de la base al crear y queda congelada (ver
  // resolverFuente en PreguntasService).
  @IsOptional()
  @IsString()
  fuente?: string;
}
