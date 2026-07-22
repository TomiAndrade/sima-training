import { RolUsuario } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class FindAllUsuariosDto {
  // Filtros sobre la vinculación. Cada uno se aplica solo si viene: sin ninguno,
  // el listado trae a todos, incluidas las personas sin vinculación o con cero
  // pares (ver UsuariosService.findAll).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  organizacionId?: number;

  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  @IsOptional()
  @IsUUID()
  puestoId?: string;

  @IsOptional()
  @IsUUID()
  centroCostoId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
