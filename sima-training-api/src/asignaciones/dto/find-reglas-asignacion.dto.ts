import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

// Filtros del listado de reglas. Cada uno se aplica solo si viene.
export class FindReglasAsignacionDto {
  @IsOptional()
  @IsUUID()
  puestoId?: string;

  @IsOptional()
  @IsUUID()
  centroCostoId?: string;

  @IsOptional()
  @IsUUID()
  moduloId?: string;

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
