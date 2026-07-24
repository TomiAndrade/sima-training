import { IsBoolean } from 'class-validator';

// Body de PATCH /reglas-asignacion/:id — baja lógica. activo=false deja de
// generar obligaciones (recalcular() ya no la considera); activo=true la
// reactiva. No se editan puesto/centro/módulo: para eso se crea otra regla.
export class UpdateReglaAsignacionDto {
  @IsBoolean()
  activo!: boolean;
}
