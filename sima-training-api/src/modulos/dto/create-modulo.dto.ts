import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateModuloDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
