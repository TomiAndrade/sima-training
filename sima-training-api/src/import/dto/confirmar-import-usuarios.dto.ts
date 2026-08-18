import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

// Una fila ya resuelta por la revisión humana del preview: dni/nombre/apellido
// + puestoId/centroCostoId REALES (el catálogo nuevo, si hacía falta, ya se
// creó del lado del frontend antes de mandar esto). puestoId/centroCostoId son
// obligatorios a nivel de tipo (sin @IsOptional): estructuralmente no existe
// forma de mandar una fila sin catálogo resuelto, lo que hace cumplir acá la
// regla "nunca un usuario activo sin puesto y centro de costo".
export class FilaConfirmarUsuarioDto {
  @IsString()
  @IsNotEmpty()
  dni!: string;

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  apellido!: string;

  @IsUUID('4')
  puestoId!: string;

  @IsUUID('4')
  centroCostoId!: string;

  // Fila del Excel original (preview.filas[].index), solo para que los
  // errores del resultado referencien el mismo número de fila que vio el
  // admin en el preview, en vez de la posición dentro de este array.
  @IsOptional()
  @IsInt()
  filaIndex?: number;
}

// Body de POST /import/usuarios/confirm. Igual que confirmarPreguntas: las
// filas ya vienen resueltas por el frontend desde el preview (puesto/centro de
// costo ya matcheados o creados), no se re-sube el Excel — por eso es JSON, no
// multipart.
export class ConfirmarImportUsuariosDto {
  @IsInt()
  organizacionId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilaConfirmarUsuarioDto)
  usuarios!: FilaConfirmarUsuarioDto[];
}
