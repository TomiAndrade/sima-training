import { PartialType } from '@nestjs/mapped-types';
import { CreatePuestoDto } from './create-puesto.dto';

export class UpdatePuestoDto extends PartialType(CreatePuestoDto) {}
