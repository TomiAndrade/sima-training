import { IsNotEmpty, IsString } from 'class-validator';

// Login de la app tablet: sólo DNI, sin contraseña ni PIN todavía. Ver el
// comentario de TabletService.login() y docs/autenticacion-tablet.md — es
// PROVISIONAL mientras se resuelve el spike de autenticación de atril.
export class LoginTabletDto {
  @IsString()
  @IsNotEmpty()
  dni!: string;
}
