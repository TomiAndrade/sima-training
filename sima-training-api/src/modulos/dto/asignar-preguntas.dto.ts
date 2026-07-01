import { IsBoolean, IsInt, IsOptional, IsUUID } from 'class-validator';

// El body del endpoint es un array de estos items (ver ParseArrayPipe en el controller).
export class AsignarPreguntaItemDto {
  @IsUUID('4')
  preguntaId!: string;

  @IsInt()
  orden!: number;

  @IsOptional()
  @IsBoolean()
  obligatoria?: boolean;
}
