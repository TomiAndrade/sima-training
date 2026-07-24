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
import { CreateReglaAsignacionDto } from './dto/create-regla-asignacion.dto';
import { FindReglasAsignacionDto } from './dto/find-reglas-asignacion.dto';
import { UpdateReglaAsignacionDto } from './dto/update-regla-asignacion.dto';
import { ReglasAsignacionService } from './reglas-asignacion.service';

@Controller('reglas-asignacion')
export class ReglasAsignacionController {
  constructor(private readonly reglas: ReglasAsignacionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateReglaAsignacionDto) {
    return this.reglas.create(dto);
  }

  @Get()
  findAll(@Query() query: FindReglasAsignacionDto) {
    return this.reglas.findAll(query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReglaAsignacionDto,
  ) {
    return this.reglas.setActivo(id, dto.activo);
  }
}
