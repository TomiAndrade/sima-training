import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GESTION_NOMINA, LECTURA_BACKOFFICE } from '../auth/matriz-permisos';
import { Roles } from '../auth/roles.decorator';
import { CreatePuestoDto } from './dto/create-puesto.dto';
import { FindPuestosDto } from './dto/find-puestos.dto';
import { UpdatePuestoDto } from './dto/update-puesto.dto';
import { PuestosService } from './puestos.service';

@Controller('puestos')
export class PuestosController {
  constructor(private readonly puestos: PuestosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles(...GESTION_NOMINA)
  create(@Body() dto: CreatePuestoDto) {
    return this.puestos.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  findAll(@Query() query: FindPuestosDto) {
    return this.puestos.findAll(query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...GESTION_NOMINA)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePuestoDto) {
    return this.puestos.update(id, dto);
  }
}
