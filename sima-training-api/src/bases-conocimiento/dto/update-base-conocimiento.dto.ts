import { PartialType } from '@nestjs/mapped-types';
import { CreateBaseConocimientoDto } from './create-base-conocimiento.dto';

export class UpdateBaseConocimientoDto extends PartialType(
  CreateBaseConocimientoDto,
) {}
