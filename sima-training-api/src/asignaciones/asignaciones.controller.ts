import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AsignacionesService } from './asignaciones.service';
import { CreateAsignacionDto } from './dto/create-asignacion.dto';
import { FindAsignacionesDto } from './dto/find-asignaciones.dto';

@Controller('asignaciones')
export class AsignacionesController {
  constructor(private readonly asignaciones: AsignacionesService) {}

  @Get()
  findByUsuario(@Query() query: FindAsignacionesDto) {
    return this.asignaciones.findByUsuario(query.usuarioId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateAsignacionDto) {
    return this.asignaciones.createManual(dto);
  }

  // Deriva las AUTOMATICA de la persona a partir de sus pares activos y las
  // reglas vigentes. Devuelve { creadas, revocadas }.
  @Post('recalcular/:usuarioId')
  @UseGuards(JwtAuthGuard)
  recalcular(@Param('usuarioId', ParseIntPipe) usuarioId: number) {
    return this.asignaciones.recalcular(usuarioId);
  }

  @Patch(':id/revocar')
  @UseGuards(JwtAuthGuard)
  revocar(@Param('id', ParseUUIDPipe) id: string) {
    return this.asignaciones.revocar(id);
  }
}
