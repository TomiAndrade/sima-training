import { SetMetadata } from '@nestjs/common';

// Marca una ruta como exenta del guard global de JwtAuthGuard (Story 4). No
// existía ningún patrón de este tipo en el proyecto antes: los ~40 guards de
// hoy son todos @UseGuards(JwtAuthGuard) puestos ruta por ruta. Con el guard
// global, "no tener el decorador" ya no alcanza para dejar una ruta abierta.
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
