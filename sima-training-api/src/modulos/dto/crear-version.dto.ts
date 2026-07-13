import { IsBoolean } from 'class-validator';

// Crea un BORRADOR nuevo a partir del ACTIVO. `esNuevaLinea` define cómo se numerará
// al Activar: true = versión nueva (sube MAYOR), false = actualización (sube MENOR).
export class CrearVersionDto {
  @IsBoolean()
  esNuevaLinea!: boolean;
}
