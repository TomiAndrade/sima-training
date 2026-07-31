import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

// Filtro del listado. Se aplica solo si viene: sin ?activa= el endpoint
// devuelve el catálogo completo (activas y dadas de baja), mismo criterio que
// /puestos y /centros-costo — los consumidores necesitan poder nombrar una base
// ya elegida que después se desactivó.
export class FindBasesConocimientoDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  activa?: boolean;
}
