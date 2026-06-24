import { TipoOrganizacion } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateOrganizacionDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsOptional()
  @IsEnum(TipoOrganizacion)
  tipo?: TipoOrganizacion;

  @IsOptional()
  @IsInt()
  organizacionPadreId?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
