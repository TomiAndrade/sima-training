import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateNivelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nombre!: string;

  // Opcional: si no viene, se appendea al final de la escala (mismo patrón que
  // asignarPreguntas en ModulosService). Para mover un nivel ya creado no se
  // usa esto, va PUT /:id/niveles/orden — ver reordenarNiveles().
  @IsOptional()
  @IsInt()
  orden?: number;
}
