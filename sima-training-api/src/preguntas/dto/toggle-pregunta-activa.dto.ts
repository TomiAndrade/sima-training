import { IsBoolean } from 'class-validator';

// Body de PATCH /preguntas/:id — papelera global. activa=false envía la
// pregunta a papelera y cascadea a sus pivots en versiones BORRADOR/ACTIVO
// (nunca ARCHIVADO, son inmutables); activa=true recupera pero NO restaura
// los pivots (asimetría intencional, el admin reactiva módulo por módulo si
// quiere).
export class TogglePreguntaActivaDto {
  @IsBoolean()
  activa!: boolean;
}
