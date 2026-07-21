import { PartialType } from '@nestjs/mapped-types';
import { CreateCentroCostoDto } from './create-centro-costo.dto';

export class UpdateCentroCostoDto extends PartialType(CreateCentroCostoDto) {}
