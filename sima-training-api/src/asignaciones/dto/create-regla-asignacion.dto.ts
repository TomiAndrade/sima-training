import { IsUUID } from 'class-validator';

// Alta de una regla: el par (puesto, centro de costo) obliga a rendir un módulo.
// No lleva `activo`: una regla nueva nace activa. Reactivar una regla dada de
// baja para el mismo triple se resuelve reenviando este POST (el service la
// reactiva en vez de romper con el @unique del triple).
export class CreateReglaAsignacionDto {
  @IsUUID()
  puestoId!: string;

  @IsUUID()
  centroCostoId!: string;

  @IsUUID()
  moduloId!: string;
}
