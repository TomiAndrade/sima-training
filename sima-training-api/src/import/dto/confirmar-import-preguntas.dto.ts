import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreatePreguntaDto } from '../../preguntas/dto/create-pregunta.dto';

// Body de POST /import/preguntas/confirm. Las preguntas ya vienen seleccionadas
// y parseadas por el frontend desde el preview (no se re-sube el Excel), por eso
// el confirm es JSON en vez de multipart.
export class ConfirmarImportPreguntasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePreguntaDto)
  preguntas!: CreatePreguntaDto[];

  // Módulo destino opcional: si viene, las preguntas creadas se asignan a él.
  @IsOptional()
  @IsUUID('4')
  moduloId?: string;
}
