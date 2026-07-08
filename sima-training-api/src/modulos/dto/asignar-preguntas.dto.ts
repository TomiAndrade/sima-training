import { IsBoolean, IsInt, IsOptional, IsUUID } from 'class-validator';

// El body del endpoint es un array de estos items (ver ParseArrayPipe en el controller).
export class AsignarPreguntaItemDto {
  @IsUUID('4')
  preguntaId!: string;

  // Opcional: si no viene, asignarPreguntas lo appendea al final de la versión
  // (siguiente al orden máximo). Los llamadores que ya calculan orden lo siguen pasando.
  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsBoolean()
  obligatoria?: boolean;
}
