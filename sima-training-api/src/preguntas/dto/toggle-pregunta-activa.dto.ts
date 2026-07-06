import { IsBoolean } from 'class-validator';

// Body de PATCH /preguntas/:id — papelera global. activa=false envía la
// pregunta a papelera y cascadea a todos sus pivots (todas sus asignaciones a
// módulos); activa=true recupera pero NO restaura los pivots (asimetría
// intencional, el admin reactiva módulo por módulo si quiere).
export class TogglePreguntaActivaDto {
  @IsBoolean()
  activa!: boolean;
}
