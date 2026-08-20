import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

// Una respuesta cruda: qué pregunta y qué contestó la persona. Nada de si estuvo
// bien — eso lo decide el backend (ver corregir.ts).
export class RespuestaSesionDto {
  @IsUUID('4')
  preguntaId!: string;

  // Ausente o null = no contestó. @IsOptional() saltea los dos, así que la tablet
  // puede mandar cualquiera de las dos formas.
  @IsOptional()
  @IsString()
  respuestaDada?: string | null;
}

// Body para registrar una rendición. OJO con lo que NO está acá y es a propósito:
// `correctas`, `total`, `porcentaje`, `aprobada` y el umbral NO se aceptan del
// cliente. Los calcula el service con corregir.ts.
//
// La ValidationPipe global de main.ts corre con whitelist + forbidNonWhitelisted, así
// que mandar `aprobada: true` no es un campo ignorado en silencio: es un 400. Para
// que esa garantía alcance también a los items de `respuestas[]` hace falta el
// @ValidateNested({ each: true }) + @Type() de abajo — sin ellos la pipe no entra al
// array y un item podría colar campos de más.
//
// Segunda línea de defensa: la pipe es global de main.ts y no corre cuando se llama
// al service directo (mismo hueco ya documentado para sembrarSimaCheck()). Por eso el tipo
// simplemente no tiene esos campos y el service nunca los lee.
export class RegistrarSesionDto {
  @Type(() => Number)
  @IsInt()
  usuarioId!: number;

  // La versión concreta que se rindió, no el módulo: un score sólo significa algo
  // contra el set de preguntas que estaba publicado en ese momento.
  @IsUUID('4')
  moduloVersionId!: string;

  // Qué obligación venía a cumplir. Opcional: si no viene, el service resuelve la
  // asignación vigente de ese (usuario, módulo) — a lo sumo hay una, lo garantiza el
  // índice parcial asignaciones_usuario_modulo_vigente.
  @IsOptional()
  @IsUUID('4')
  asignacionId?: string;

  // Reloj DEL DISPOSITIVO, no autoritativo (ver el comentario de Sesion en el
  // schema): con el modo offline el POST llega horas después. La fecha oficial de la
  // rendición es el createdAt que pone el servidor. Si no viene, la fila usa now().
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  iniciadaEn?: Date;

  @Type(() => Date)
  @IsDate()
  finalizadaEn!: Date;

  // Al menos una: una rendición sin respuestas no es una rendición.
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RespuestaSesionDto)
  respuestas!: RespuestaSesionDto[];

  // UUID que genera la APP al empezar el intento (ver el comentario de Sesion
  // en el schema) — no lo genera el backend. Ausente = sesión no-idempotente
  // (seed, futuros endpoints de backoffice).
  @IsOptional()
  @IsUUID('4')
  claveIdempotencia?: string;
}
