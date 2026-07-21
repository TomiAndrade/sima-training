import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePuestoDto } from './dto/create-puesto.dto';
import { UpdatePuestoDto } from './dto/update-puesto.dto';
import { PuestosService } from './puestos.service';

@Controller('puestos')
export class PuestosController {
  constructor(private readonly puestos: PuestosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePuestoDto) {
    return this.puestos.create(dto);
  }

  @Get()
  findAll() {
    return this.puestos.findAll();
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePuestoDto) {
    return this.puestos.update(id, dto);
  }
}
