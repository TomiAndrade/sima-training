import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

// Filtros del listado de reglas. Cada uno se aplica solo si viene.
export class FindReglasAsignacionDto {
  // Literal: trae SÓLO las reglas de ese puesto. Las de centro (sin puesto) no
  // entran acá aunque le apliquen a ese puesto — para eso está ?alcance=CENTRO.
  @IsOptional()
  @IsUUID()
  puestoId?: string;

  @IsOptional()
  @IsUUID()
  centroCostoId?: string;

  @IsOptional()
  @IsUUID()
  moduloId?: string;

  // ?alcance=CENTRO → sólo reglas de centro (sin puesto).
  // ?alcance=PUESTO → sólo reglas por par exacto (con puesto).
  // Ausente → las dos.
  @IsOptional()
  @IsIn(['PUESTO', 'CENTRO'])
  alcance?: 'PUESTO' | 'CENTRO';

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
