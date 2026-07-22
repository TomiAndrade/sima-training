import { RolUsuario } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

// Un par (puesto, centro de costo) de VinculacionPuestoCentro. Los dos campos
// son obligatorios: un par siempre viene completo, nunca un puesto sin centro
// ni al revés (docs/modelo-vinculacion-propuesto.md §1.1).
export class ParPuestoCentroDto {
  @IsUUID()
  puestoId!: string;

  @IsUUID()
  centroCostoId!: string;
}

// Organización + rol de la persona. Son únicos por usuario (una vinculación por
// usuario), por eso van acá y no en `Usuario`, que quedó como identidad pura.
export class CreateVinculacionDto {
  @IsInt()
  organizacionId!: number;

  @IsEnum(RolUsuario)
  rol!: RolUsuario;

  // Cero pares es una cardinalidad válida: el pivote arranca vacío y se
  // completa desde el ABM. El primero que se cargue queda como principal.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParPuestoCentroDto)
  pares?: ParPuestoCentroDto[];
}

export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  apellido!: string;

  @IsString()
  @IsNotEmpty()
  dni!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Obligatoria: `Vinculacion.organizacionId` es NOT NULL, así que no hay forma
  // de dar de alta a una persona sin decir a qué organización pertenece y con
  // qué rol.
  @ValidateNested()
  @Type(() => CreateVinculacionDto)
  vinculacion!: CreateVinculacionDto;

  // Datos flexibles de nómina (jsonb). Estructura abierta a propósito (§3.4-a).
  @IsOptional()
  @IsObject()
  datos?: Record<string, unknown>;
}
