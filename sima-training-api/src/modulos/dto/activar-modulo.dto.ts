import { IsBoolean, IsOptional } from 'class-validator';

// Body de PATCH /modulos/:id/activar. `esNuevaLinea` define cómo se numera:
// true = versión nueva (sube MAYOR), false = actualización (sube MENOR).
// Opcional a nivel DTO porque la primera publicación de un módulo no tiene de
// qué elegir; el service exige el valor cuando ya hay un ACTIVO publicado.
export class ActivarModuloDto {
  @IsOptional()
  @IsBoolean()
  esNuevaLinea?: boolean;
}
