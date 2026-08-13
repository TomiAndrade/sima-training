import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Cómo se rinde una versión de módulo. Es el body de PUT /modulos/:id/parametros
// y además se embebe en CreateModuloDto (los valores que se eligen al crear van a
// la v1 BORRADOR que nace con el módulo).
//
// Los cuatro son opcionales y NULLABLE, y esa es la parte que importa: `null`
// significa "usar el default global" (3 preguntas / 70% / sin tope / sin espera),
// no cero. @IsOptional() de class-validator saltea undefined Y null, así que el
// backoffice vuelve un campo al default mandando null — con undefined el PUT no
// podría distinguir "no lo toques" de "sacálo", y este endpoint reemplaza el set
// completo.
export class ParametrosExamenDto {
  // Cuántas preguntas sortea un examen del pool de la versión. Menos preguntas en
  // el pool que este número no es un error: sortear() devuelve las que haya.
  @IsOptional()
  @IsInt()
  @Min(1)
  preguntasPorExamen?: number | null;

  // En PORCENTAJE, no en cantidad de correctas: es lo que se compara contra el
  // score redondeado de la sesión y lo que se congela en Sesion.umbralAprobacion.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  umbralAprobacion?: number | null;

  // Tope de intentos por MÓDULO (todas sus versiones), con el contador reseteado
  // en cada aprobación — ver tablet/reintentos.ts.
  @IsOptional()
  @IsInt()
  @Min(1)
  maxIntentos?: number | null;

  // Espera mínima entre dos intentos, en minutos.
  @IsOptional()
  @IsInt()
  @Min(1)
  esperaEntreIntentosMinutos?: number | null;
}
