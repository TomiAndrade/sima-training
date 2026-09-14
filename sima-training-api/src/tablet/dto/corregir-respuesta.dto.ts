import { IsOptional, IsString, IsUUID } from 'class-validator';

// Body de la corrección de UNA respuesta, mientras la persona todavía está
// rindiendo. Lo comparten el flujo de alumno y el de invitado: los dos corrigen
// igual, y a diferencia de registrar una sesión acá no hay nada que dependa de
// quién rinde (ni `usuarioId`, ni `asignacionId`, ni `claveIdempotencia`).
//
// Igual que RegistrarSesionDto, lo que NO está acá es a propósito: el cliente
// manda qué contestó, nunca si estuvo bien. Eso lo decide corregir.ts.
export class CorregirRespuestaDto {
  // La versión concreta que se está rindiendo. Es contra ella que se valida que
  // la pregunta pertenezca al examen — sin esto, el endpoint sería un oráculo
  // para pedir la respuesta de CUALQUIER pregunta del banco por su id.
  @IsUUID('4')
  moduloVersionId!: string;

  @IsUUID('4')
  preguntaId!: string;

  // Ausente o null = no contestó, y se corrige como incorrecta (esCorrecta() ya
  // lo trata así). Hoy la app siempre manda algo —se corrige al tocar una
  // opción— pero el contrato acompaña al de RegistrarSesionDto.
  @IsOptional()
  @IsString()
  respuestaDada?: string | null;
}
