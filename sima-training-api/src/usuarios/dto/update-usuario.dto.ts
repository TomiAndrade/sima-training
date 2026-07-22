import { OmitType, PartialType } from '@nestjs/mapped-types';
import { RolUsuario } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { CreateUsuarioDto, ParPuestoCentroDto } from './create-usuario.dto';

export class UpdateVinculacionDto {
  @IsOptional()
  @IsInt()
  organizacionId?: number;

  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  // Si viene, REEMPLAZA el set completo de pares (no es un merge): los que
  // había se borran y se crean los de la lista. Omitirlo deja los pares como
  // estaban.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParPuestoCentroDto)
  pares?: ParPuestoCentroDto[];
}

// `vinculacion` se omite del PartialType y se redeclara: en el alta sus campos
// son obligatorios, en la edición todos son opcionales (se puede cambiar solo
// el rol, o solo los pares).
export class UpdateUsuarioDto extends PartialType(
  OmitType(CreateUsuarioDto, ['vinculacion'] as const),
) {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateVinculacionDto)
  vinculacion?: UpdateVinculacionDto;
}
