import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';

// Un criterio: QUÉ evalúa el módulo, en términos de la clasificación del banco.
export class CriterioItemDto {
  @IsUUID('4')
  baseConocimientoId!: string;

  // Ausente/null = "cualquier nivel de esta base". @IsOptional() de
  // class-validator saltea tanto undefined como null, así que el frontend puede
  // mandar cualquiera de los dos.
  @IsOptional()
  @IsUUID('4')
  nivelId?: string;
}

// Body de PUT /modulos/:id/criterios. Es el set COMPLETO de criterios de la
// versión, no un alta puntual — mismo criterio que
// PUT /bases-conocimiento/:id/niveles/orden: el cliente manda el estado deseado
// y el servidor resuelve el diff.
//
// El array VACÍO es válido y significa "sacar todos los criterios": el módulo
// vuelve a ser 100% manual y se borran los pivots que los criterios trajeron.
// Por eso no lleva @ArrayNotEmpty.
export class SetCriteriosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterioItemDto)
  criterios!: CriterioItemDto[];
}
