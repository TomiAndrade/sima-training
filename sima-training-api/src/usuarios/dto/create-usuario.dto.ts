import { ClasificacionAlumno, RolUsuario } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

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

  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  // Clasificación del alumno (excluyente). Solo aplica a rol ALUMNO.
  @IsOptional()
  @IsEnum(ClasificacionAlumno)
  clasificacion?: ClasificacionAlumno;

  @IsOptional()
  @IsInt()
  organizacionId?: number;

  // Datos flexibles de nómina (jsonb). Estructura abierta a propósito (§3.4-a).
  @IsOptional()
  @IsObject()
  datos?: Record<string, unknown>;
}
