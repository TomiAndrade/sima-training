import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

// Todo lo que se le pide a un invitado para entrar: su nombre.
//
// Es una ETIQUETA, no una identidad — nadie la verifica y cualquiera escribe
// cualquier cosa. Alcanza para lo único que se le pide al modo invitado ("cuánta
// gente lo probó y cómo le fue"), y NO se puede tratar como un registro de
// personas ni cruzar con Usuario.
//
// Obligatorio y no opcional a propósito: un nombre vacío devuelve el reporte a
// una lista de "invitado" sin cara, que es justo lo que se quería evitar.
export class LoginInvitadoDto {
  // El trim va ANTES de la validación de largo, si no "   " (tres espacios)
  // pasaría el @Length(2) y quedaría una fila con nombre en blanco.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  // 120 es el largo de la columna (VarChar(120)): validar acá evita que un
  // nombre largo llegue a Postgres y explote como 500 en vez de 400.
  @Length(2, 120, {
    message: 'El nombre debe tener entre 2 y 120 caracteres',
  })
  nombre!: string;
}
