import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { RespuestaSesionDto } from '../../sesiones/dto/registrar-sesion.dto';

// Body para registrar una rendición de DEMO. Reusa RespuestaSesionDto (una
// respuesta cruda es una respuesta cruda), pero es una clase propia y no un
// OmitType de RegistrarSesionDto: lo que sobra ahí no es un campo sino tres, y
// los tres por motivos distintos.
//
//   - `usuarioId`   → no hay usuario. El nombre sale del token (ver
//                     invitado-auth.guard.ts).
//   - `asignacionId`→ un invitado no viene a cumplir ninguna obligación. La
//                     demo no toca Asignacion en ningún sentido.
//   - `claveIdempotencia` → es el mecanismo del modo offline, que en la demo no
//                     aplica: el invitado rinde conectado y ahí mismo. Ver el
//                     comentario de SesionInvitado en el schema.
//
// Igual que en el DTO real, acá NO se aceptan `correctas`/`total`/`porcentaje`/
// `aprobada`: el resultado lo calcula el backend con el mismo corregir.ts. Que
// sea una demo no significa que el cliente pueda mandar su propio puntaje — el
// reporte de invitados dejaría de significar nada.
export class RegistrarSesionInvitadoDto {
  @IsUUID('4')
  moduloVersionId!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  iniciadaEn?: Date;

  @Type(() => Date)
  @IsDate()
  finalizadaEn!: Date;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RespuestaSesionDto)
  respuestas!: RespuestaSesionDto[];
}
