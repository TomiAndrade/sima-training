import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

// Filtros del listado del catálogo. Se aplican solo si vienen: sin ?activo=
// el endpoint sigue devolviendo el catálogo completo (activos y dados de baja),
// que es lo que necesitan los consumidores que muestran el nombre de un puesto
// ya elegido y después desactivado.
export class FindPuestosDto {
  // ?activo=true / ?activo=false. Sin el @Transform, class-validator recibe el
  // string crudo.
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  activo?: boolean;
}
