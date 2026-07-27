import { IsOptional, IsUUID } from 'class-validator';

// Alta de una regla de módulo obligatorio, en cualquiera de sus dos alcances:
//   - con puestoId  → regla por PAR EXACTO: sólo quien ejerce ese puesto en ese centro.
//   - sin puestoId  → regla de CENTRO: aplica a todos los puestos de ese centro.
// No lleva `activo`: una regla nueva nace activa. Reactivar una regla dada de baja
// se resuelve reenviando este POST (el service la reactiva en vez de duplicarla).
export class CreateReglaAsignacionDto {
  // Ausente o null = regla de centro. Es la única diferencia entre los dos alcances.
  @IsOptional()
  @IsUUID()
  puestoId?: string;

  @IsUUID()
  centroCostoId!: string;

  @IsUUID()
  moduloId!: string;
}
