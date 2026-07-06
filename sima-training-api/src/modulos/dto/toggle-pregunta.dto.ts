import { IsBoolean } from 'class-validator';

// Body de PATCH /modulos/:id/preguntas/:preguntaId — activa/desactiva la
// asignación de la pregunta en la versión vigente del módulo (baja por módulo).
export class TogglePreguntaDto {
  @IsBoolean()
  activa!: boolean;
}
