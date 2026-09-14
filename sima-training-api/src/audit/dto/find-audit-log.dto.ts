import { RolUsuario } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

// Filtros del log GLOBAL (GET /audit-log). Cada uno se aplica sólo si viene.
// `entidad` es String libre y no un enum: la tabla es polimórfica a propósito
// (ver AuditLog en schema.prisma) y el set de entidades auditadas crece sin
// tocar este DTO.
export class FindAuditLogDto {
  @IsOptional()
  @IsString()
  entidad?: string;

  @IsOptional()
  @IsEnum(RolUsuario)
  actorRol?: RolUsuario;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  actorUsuarioId?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  desde?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  hasta?: Date;

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
