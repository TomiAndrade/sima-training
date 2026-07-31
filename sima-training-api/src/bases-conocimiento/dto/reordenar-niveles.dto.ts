import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

// Set completo de niveles de la base, en el orden deseado. Se manda la escala
// entera y no un movimiento puntual porque reindexar todo es lo único que cubre
// tanto un swap de adyacentes como mover un nivel a una posición arbitraria
// (de la 5 a la 1 desplaza a las cuatro del medio).
export class ReordenarNivelesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  nivelIds!: string[];
}
